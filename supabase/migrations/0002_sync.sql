-- 0002_sync.sql — server side of the custom push/pull sync (src/lib/db/sync).
--
-- Two clocks per tracker row:
--   updated_at         client-authoritative logical timestamp, bumped by the device on
--                      every local write. Used for last-write-wins (LWW).
--   server_updated_at  set by the server on every accepted write. Used ONLY as the
--                      pull cursor, so rows pushed late by an offline device are still
--                      pulled by other devices (a client clock cannot be a cursor).
--
-- Write rules (enforced by sync_row_write, mirrored by src/lib/db/sync/merge.ts):
--   1. Stale write (incoming updated_at < stored updated_at) is ignored, EXCEPT
--   2. deletes are sticky: a stale soft delete still deletes, and a delete is never undone.
--   3. Identical replays (same updated_at and same content) are no-ops, so echoes
--      do not bump server_updated_at and cannot ping-pong between devices.
--   4. Equal updated_at with different content: the incoming write wins (server is
--      the sequencer; clients accept the pulled row on ties, so all replicas converge).
--   5. user_id and created_at are immutable.
--
-- 0001's set_updated_at triggers on these tables are replaced: they overwrote the
-- client's updated_at, which breaks LWW.

do $$
declare
  t text;
begin
  foreach t in array array['exercises', 'routines', 'routine_exercises', 'workouts', 'sets']
  loop
    execute format('alter table public.%I add column server_updated_at timestamptz not null default now()', t);
    execute format('drop trigger if exists %1$s_updated_at on public.%1$I', t);
    execute format('create index %1$s_pull_idx on public.%1$I (user_id, server_updated_at, id)', t);
  end loop;
end;
$$;

create or replace function public.sync_row_write()
returns trigger
language plpgsql
as $$
declare
  incoming_deleted_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'user_id is immutable';
    end if;
    new.created_at := old.created_at;

    if new.updated_at < old.updated_at then
      -- Stale write. Only a soft delete survives (rule 2); content stays the newer one.
      if new.deleted_at is not null and old.deleted_at is null then
        incoming_deleted_at := new.deleted_at;
        new := old;
        new.deleted_at := incoming_deleted_at;
      else
        return null;  -- ignore silently; the pushing client will pull the newer row
      end if;
    elsif old.deleted_at is not null and new.deleted_at is null then
      new.deleted_at := old.deleted_at;  -- never undelete (rule 2)
    end if;

    if (to_jsonb(new) - 'server_updated_at') = (to_jsonb(old) - 'server_updated_at') then
      return null;  -- identical replay (rule 3)
    end if;
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['exercises', 'routines', 'routine_exercises', 'workouts', 'sets']
  loop
    execute format(
      'create trigger %1$s_sync_write before insert or update on public.%1$I
         for each row execute function public.sync_row_write()', t);
  end loop;
end;
$$;
