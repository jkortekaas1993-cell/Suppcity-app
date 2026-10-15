-- 0004_consents_retention.sql — consent RPCs (hard rule 2) and retention (hard rule 9).

-- ---------------------------------------------------------------------------
-- Consents. The log stays append-only; the server sets the timestamp so a client
-- cannot backdate a grant.
-- ---------------------------------------------------------------------------
create or replace function public.consents_server_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.created_at := clock_timestamp();
  return new;
end;
$$;
create trigger consents_server_timestamp before insert on public.consents
  for each row execute function public.consents_server_timestamp();

-- Grant or revoke one consent. SECURITY INVOKER: the RLS insert policy applies.
create or replace function public.set_consent(p_consent_type text, p_granted boolean, p_policy_version text)
returns public.current_consents
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row public.current_consents;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(length(p_policy_version), 0) = 0 then
    raise exception 'policy_version required';
  end if;
  insert into public.consents (user_id, consent_type, granted, policy_version, source)
  values (auth.uid(), p_consent_type, p_granted, p_policy_version, 'app')
  returning user_id, consent_type, granted, policy_version, created_at into row;
  return row;
end;
$$;
grant execute on function public.set_consent(text, boolean, text) to authenticated;
revoke execute on function public.set_consent(text, boolean, text) from public, anon;

-- ---------------------------------------------------------------------------
-- Retention (values mirror RETENTION_DAYS in src/lib/config/constants.ts):
--   soft-deleted tracker/stock rows  30 days  → hard delete
--   consent log                      5 years  → delete events, except the current
--                                               state row per (user, type)
--   inactive account (no sign-in)    2 years  → notice 30 days before, then delete
--   anonymous deletion confirmations 5 years
-- ---------------------------------------------------------------------------
create table public.retention_notices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notice_created_at timestamptz not null default now(),
  notice_sent_at timestamptz            -- set by the mailer once the e-mail went out
);
alter table public.retention_notices enable row level security;  -- service only

create or replace function public.run_retention(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  n integer;
  purged jsonb := '{}';
  u record;
  deleted_accounts integer := 0;
  notices integer;
begin
  -- 1. Soft-deleted rows. Children first so FK cascades do not hide counts.
  foreach t in array array['sets', 'routine_exercises', 'workouts', 'routines', 'exercises', 'stock_items']
  loop
    execute format('delete from public.%I where deleted_at < $1 - interval ''30 days''', t) using p_now;
    get diagnostics n = row_count;
    purged := purged || jsonb_build_object(t, n);
  end loop;

  -- 2. Consent log older than 5 years, but never the latest event per user+type.
  delete from public.consents c
  where c.created_at < p_now - interval '5 years'
    and exists (select 1 from public.consents newer
                where newer.user_id = c.user_id and newer.consent_type = c.consent_type
                  and newer.created_at > c.created_at);
  get diagnostics n = row_count;
  purged := purged || jsonb_build_object('consents', n);

  delete from public.account_deletions where deleted_at < p_now - interval '5 years';

  -- 3. Inactive accounts. A sign-in after the notice cancels it.
  delete from public.retention_notices rn using auth.users au
  where au.id = rn.user_id and coalesce(au.last_sign_in_at, au.created_at) > rn.notice_created_at;

  insert into public.retention_notices (user_id, notice_created_at)
  select au.id, p_now from auth.users au
  where coalesce(au.last_sign_in_at, au.created_at) < p_now - interval '2 years' + interval '30 days'
  on conflict (user_id) do nothing;
  get diagnostics notices = row_count;

  for u in
    select rn.user_id from public.retention_notices rn join auth.users au on au.id = rn.user_id
    where coalesce(au.last_sign_in_at, au.created_at) < p_now - interval '2 years'
      and rn.notice_created_at <= p_now - interval '30 days'
  loop
    perform public.delete_account(u.user_id, 'inactivity');
    deleted_accounts := deleted_accounts + 1;
  end loop;

  return purged || jsonb_build_object('notices_created', notices, 'accounts_deleted', deleted_accounts);
end;
$$;
revoke execute on function public.run_retention(timestamptz) from public, anon, authenticated;
grant execute on function public.run_retention(timestamptz) to service_role;

-- pg_cron schedule (daily 03:17 UTC). pg_cron exists on Supabase; skipped where absent
-- (plain local Postgres used by supabase/tests).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('suppcity-retention', '17 3 * * *', 'select public.run_retention()');
  else
    raise notice 'pg_cron not available: schedule run_retention() manually';
  end if;
end;
$$;

-- Logged-out users work purely locally: no table access for anon (as in 0001).
revoke all on all tables in schema public from anon;
