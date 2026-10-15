-- 0006_hardening.sql — review/compliance fixes (pre-beta).
--   H2  18+ confirmation only via the confirm_adult() RPC; adult_confirmed_at and
--       deleted_at can no longer be written by clients.
--   M3  updated_at from clients is capped at now() + 5 minutes.
--   M5  stale pending redemptions (> 1 hour, no code) are refunded by a sweep.
--   Low consents.source is always 'app' for clients; fixed search_path on trigger functions.

-- ---------------------------------------------------------------------------
-- H2: protected profile columns.
-- A "client" is a request running as the API roles authenticated/anon. Inside a
-- SECURITY DEFINER function (confirm_adult, delete_account, ...) current_user is the
-- function owner, so those server paths still work; the service role is trusted.
-- ---------------------------------------------------------------------------
create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_client boolean := current_user in ('authenticated', 'anon') and auth.role() <> 'service_role';
begin
  if auth.role() <> 'service_role' and new.shopify_customer_id is distinct from old.shopify_customer_id then
    raise exception 'shopify_customer_id can only be set server-side';
  end if;
  if is_client and new.adult_confirmed_at is distinct from old.adult_confirmed_at then
    raise exception 'adult_confirmed_at can only be set via confirm_adult()';
  end if;
  if is_client and new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted_at can only be set server-side';
  end if;
  return new;
end;
$$;

-- 18+ self-declaration (hard rule 5). Sets the server timestamp once; never backdated,
-- never moved, never cleared by the client. Returns the stored timestamp.
create or replace function public.confirm_adult()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  confirmed timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
  set adult_confirmed_at = now()
  where user_id = uid and adult_confirmed_at is null and deleted_at is null;
  select adult_confirmed_at into confirmed from public.profiles where user_id = uid and deleted_at is null;
  if confirmed is null then
    raise exception 'profile not found';
  end if;
  return confirmed;
end;
$$;
revoke execute on function public.confirm_adult() from public, anon;
grant execute on function public.confirm_adult() to authenticated;

-- ---------------------------------------------------------------------------
-- M3: cap client clocks. A device with a clock far in the future could otherwise win
-- every last-write-wins conflict forever. Same rules as 0002 otherwise.
-- ---------------------------------------------------------------------------
create or replace function public.sync_row_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  incoming_deleted_at timestamptz;
  max_ts timestamptz := now() + interval '5 minutes';
begin
  if new.updated_at is null then
    new.updated_at := now();
  elsif new.updated_at > max_ts then
    new.updated_at := max_ts;
  end if;
  if new.deleted_at is not null and new.deleted_at > max_ts then
    new.deleted_at := max_ts;
  end if;

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

  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- M5: refund redemptions stuck in 'pending' for more than an hour without a code.
-- The client retries with the same redemptionId (stored on the device); a retry after
-- the sweep gets 'redeem_failed' ("punten teruggezet"). Service role / cron only.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_expire_stale(p_older_than interval default interval '1 hour')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select id from public.points_redemptions
    where status = 'pending' and discount_code is null and created_at < now() - p_older_than
    for update skip locked
  loop
    perform public.redeem_mark_failed(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.redeem_expire_stale(interval) from public, anon, authenticated;
grant execute on function public.redeem_expire_stale(interval) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('suppcity-redeem-sweep', '*/15 * * * *', 'select public.redeem_expire_stale()');
  else
    raise notice 'pg_cron not available: schedule redeem_expire_stale() manually';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Low: clients may only log consents as source 'app' ('web' is server-side only).
-- ---------------------------------------------------------------------------
drop policy consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()) and source = 'app');

-- Low: fixed search_path on the remaining trigger/helper functions.
alter function public.set_updated_at() set search_path = '';
alter function public.points_ledger_guard() set search_path = '';
alter function public.consents_server_timestamp() set search_path = '';
alter function public.shopify_synthetic_email(text) set search_path = '';
