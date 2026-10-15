-- 0003_accounts_points.sql — Shopify account linking, account deletion, points rules,
-- redemptions. Server-only functions are SECURITY DEFINER and executable ONLY by
-- service_role (Edge Functions). Client-callable RPCs check auth.uid() themselves.
--
-- Hard rules: 1 (points never use body/health data), 3 (deletion), 5 (points), 6 (server-side).

-- ---------------------------------------------------------------------------
-- Supabase grants EXECUTE on new functions to PUBLIC (anon + authenticated) by default.
-- From here on, nothing is executable unless granted explicitly.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account linking (used by Edge Function shopify-auth-exchange).
-- Auth users are created with a synthetic, non-deliverable e-mail derived from the
-- Shopify customer id, so Supabase never stores the customer's real e-mail
-- (data minimisation; Shopify stays the source of contact data).
-- ---------------------------------------------------------------------------
create or replace function public.shopify_synthetic_email(p_customer_gid text)
returns text
language sql
immutable
as $$
  select 'shopify-' || regexp_replace(p_customer_gid, '^gid://shopify/Customer/', '') || '@auth.suppcity.nl'
$$;

-- Find the auth user for a verified Shopify customer: by profile link first, then by
-- synthetic e-mail (covers a crash between createUser and link_shopify_customer).
create or replace function public.find_user_for_shopify_customer(p_customer_gid text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.user_id from public.profiles p where p.shopify_customer_id = p_customer_gid),
    (select u.id from auth.users u where u.email = public.shopify_synthetic_email(p_customer_gid))
  )
$$;

-- Create/repair the profile row and its Shopify link. Idempotent.
create or replace function public.link_shopify_customer(p_user_id uuid, p_customer_gid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_customer_gid !~ '^gid://shopify/Customer/[0-9]+$' then
    raise exception 'invalid Shopify customer gid';
  end if;
  insert into public.profiles (user_id, shopify_customer_id)
  values (p_user_id, p_customer_gid)
  on conflict (user_id) do update set shopify_customer_id = excluded.shopify_customer_id
    where public.profiles.shopify_customer_id is distinct from excluded.shopify_customer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Account deletion (hard rule 3). One atomic path used by delete-account,
-- customers/redact and inactivity retention: log an ANONYMOUS confirmation and
-- delete the auth user; every public.* row cascades. Orders stay in Shopify.
-- ---------------------------------------------------------------------------
create table public.account_deletions (
  id uuid primary key default gen_random_uuid(),   -- confirmation id shown to the user
  reason text not null check (reason in ('user_request', 'shopify_redact', 'inactivity')),
  deleted_at timestamptz not null default now()
  -- deliberately no user id, e-mail or Shopify id
);
alter table public.account_deletions enable row level security;  -- no policies: service only

create or replace function public.delete_account(p_user_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  confirmation uuid;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then
    return null;
  end if;
  insert into public.account_deletions (reason) values (p_reason) returning id into confirmation;
  delete from auth.users where id = p_user_id;
  return confirmation;
end;
$$;

-- ---------------------------------------------------------------------------
-- points_ledger hardening (0001 already enforces 18+ for order/workout and the
-- 3-per-ISO-week workout cap with an advisory lock).
-- Added here: sign/size per reason, ISO-week format, true append-only (also for the
-- service role), and redaction of Shopify order references.
-- ---------------------------------------------------------------------------
alter table public.points_ledger
  add constraint points_sign_per_reason check (
    (reason = 'order' and points > 0)
    or (reason = 'workout' and points between 1 and 50)
    or (reason in ('redeem', 'expiry') and points < 0)
    or (reason = 'adjustment' and points <> 0)
  ),
  add constraint points_iso_week_format check (iso_week is null or iso_week ~ '^[0-9]{4}-W[0-9]{2}$');

create or replace function public.points_ledger_append_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    -- only as part of an account deletion cascade (parent already gone)
    if exists (select 1 from auth.users where id = old.user_id) then
      raise exception 'points_ledger is append-only';
    end if;
    return old;
  end if;
  -- UPDATE: only redacting the Shopify reference of an order entry is allowed (shop/redact)
  if new.reference is null and old.reason = 'order'
     and (to_jsonb(new) - 'reference') = (to_jsonb(old) - 'reference') then
    return new;
  end if;
  raise exception 'points_ledger is append-only';
end;
$$;
create trigger points_ledger_append_only before update or delete on public.points_ledger
  for each row execute function public.points_ledger_append_only();

-- Orders → points (called by shopify-webhooks after HMAC verification).
-- Returns 'awarded' | 'duplicate' | 'no_user' | 'not_adult' | 'zero'.
create or replace function public.award_order_points(p_customer_gid text, p_order_gid text, p_points integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
begin
  if p_points <= 0 then
    return 'zero';
  end if;
  select user_id into uid from public.profiles
  where shopify_customer_id = p_customer_gid and deleted_at is null;
  if uid is null then
    return 'no_user';
  end if;
  if not exists (select 1 from public.profiles where user_id = uid and adult_confirmed_at is not null) then
    return 'not_adult';
  end if;
  insert into public.points_ledger (user_id, reason, points, reference)
  values (uid, 'order', p_points, p_order_gid)
  on conflict on constraint points_reference_unique do nothing;
  return case when found then 'awarded' else 'duplicate' end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Workout points (client-callable). Rewards the FACT that a workout was finished.
-- Never reads sets, weights, reps, body weight or Health data (hard rule 1).
-- Eligibility: own workout, source 'app' (no imports), finished, ≥ 10 minutes,
-- started within the last 8 days. Week = ISO week of started_at in Europe/Amsterdam.
-- Returns 'awarded' | 'already_awarded' | 'weekly_cap' | 'not_adult' | 'not_eligible'.
-- ---------------------------------------------------------------------------
create or replace function public.award_workout_points(p_workout_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w record;
  week text;
  rewarded integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select id, started_at, ended_at, source into w
  from public.workouts
  where id = p_workout_id and user_id = uid and deleted_at is null;
  if not found
     or w.source <> 'app'
     or w.ended_at is null
     or w.ended_at - w.started_at < interval '10 minutes'
     or w.started_at < now() - interval '8 days'
     or w.started_at > now() + interval '1 hour' then
    return 'not_eligible';
  end if;
  if not exists (select 1 from public.profiles
                 where user_id = uid and adult_confirmed_at is not null and deleted_at is null) then
    return 'not_adult';
  end if;
  if exists (select 1 from public.points_ledger
             where user_id = uid and reason = 'workout' and reference = p_workout_id::text) then
    return 'already_awarded';
  end if;
  week := to_char(w.started_at at time zone 'Europe/Amsterdam', 'IYYY-"W"IW');
  perform pg_advisory_xact_lock(hashtext(uid::text || ':' || week));
  select count(*) into rewarded from public.points_ledger
  where user_id = uid and reason = 'workout' and iso_week = week;
  if rewarded >= 3 then
    return 'weekly_cap';
  end if;
  insert into public.points_ledger (user_id, reason, points, reference, iso_week)
  values (uid, 'workout', 10, p_workout_id::text, week)
  on conflict on constraint points_reference_unique do nothing;
  return case when found then 'awarded' else 'already_awarded' end;
end;
$$;
grant execute on function public.award_workout_points(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Redemption tiers ("staffel"): config as data, readable by the app.
-- Change by inserting a new tier and deactivating the old one (keep history).
-- ---------------------------------------------------------------------------
create table public.points_redeem_tiers (
  id text primary key,
  points integer not null check (points > 0),
  value_cents integer not null check (value_cents > 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  valid_days integer not null default 90 check (valid_days > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.points_redeem_tiers enable row level security;
create policy redeem_tiers_read on public.points_redeem_tiers
  for select to authenticated using (active);

insert into public.points_redeem_tiers (id, points, value_cents, min_order_cents) values
  ('eur5', 500, 500, 2500),
  ('eur12_50', 1000, 1250, 4000),
  ('eur30', 2000, 3000, 6000);

create table public.points_redemptions (
  id uuid primary key,                         -- = client idempotency key
  user_id uuid not null references auth.users (id) on delete cascade,
  tier_id text not null references public.points_redeem_tiers (id),
  points integer not null check (points > 0),
  value_cents integer not null,
  min_order_cents integer not null,
  valid_days integer not null,
  status text not null default 'pending' check (status in ('pending', 'issued', 'failed')),
  discount_code text unique,
  shopify_discount_id text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index points_redemptions_user_idx on public.points_redemptions (user_id, created_at desc);
create trigger points_redemptions_updated_at before update on public.points_redemptions
  for each row execute function public.set_updated_at();
alter table public.points_redemptions enable row level security;
create policy redemptions_select_own on public.points_redemptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Step 1 (service role): reserve points atomically. Idempotent on p_redemption_id.
-- Returns the redemption row as jsonb, or raises 'insufficient_points' / 'unknown_tier'.
create or replace function public.redeem_reserve(p_user_id uuid, p_redemption_id uuid, p_tier_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.points_redeem_tiers;
  r public.points_redemptions;
  bal integer;
begin
  select * into r from public.points_redemptions where id = p_redemption_id;
  if found then
    if r.user_id <> p_user_id then
      raise exception 'redemption id belongs to another user';
    end if;
    return to_jsonb(r);
  end if;

  select * into t from public.points_redeem_tiers where id = p_tier_id and active;
  if not found then
    raise exception 'unknown_tier';
  end if;

  -- serialize redemptions per user so the balance check cannot be raced
  perform pg_advisory_xact_lock(hashtext('redeem:' || p_user_id::text));
  select coalesce(sum(points), 0) into bal from public.points_ledger where user_id = p_user_id;
  if bal < t.points then
    raise exception 'insufficient_points';
  end if;

  insert into public.points_redemptions (id, user_id, tier_id, points, value_cents, min_order_cents, valid_days)
  values (p_redemption_id, p_user_id, t.id, t.points, t.value_cents, t.min_order_cents, t.valid_days)
  returning * into r;
  insert into public.points_ledger (user_id, reason, points, reference)
  values (p_user_id, 'redeem', -t.points, p_redemption_id::text);
  return to_jsonb(r);
end;
$$;

-- Step 2a (service role): mark issued after Shopify created the code.
create or replace function public.redeem_mark_issued(
  p_redemption_id uuid, p_code text, p_shopify_discount_id text, p_expires_at timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.points_redemptions;
begin
  update public.points_redemptions
  set status = 'issued', discount_code = p_code, shopify_discount_id = p_shopify_discount_id,
      expires_at = p_expires_at
  where id = p_redemption_id and status in ('pending', 'issued')
  returning * into r;
  if not found then
    raise exception 'redemption not pending';
  end if;
  return to_jsonb(r);
end;
$$;

-- Step 2b (service role): Shopify definitively refused → refund points once.
create or replace function public.redeem_mark_failed(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.points_redemptions;
begin
  update public.points_redemptions set status = 'failed'
  where id = p_redemption_id and status = 'pending'
  returning * into r;
  if found then
    insert into public.points_ledger (user_id, reason, points, reference)
    values (r.user_id, 'adjustment', r.points, 'refund:' || r.id::text)
    on conflict on constraint points_reference_unique do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- GDPR requests from Shopify compliance webhooks (customers/data_request,
-- customers/redact, shop/redact). Service only. Payload ids only, no health data.
-- ---------------------------------------------------------------------------
create table public.shopify_privacy_requests (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('customers/data_request', 'customers/redact', 'shop/redact')),
  shopify_webhook_id text unique,
  shop_domain text not null,
  customer_gid text,
  status text not null default 'received' check (status in ('received', 'completed', 'no_data')),
  received_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.shopify_privacy_requests enable row level security;  -- no policies: service only

-- Data the app holds for a Shopify customer (for customers/data_request; the shop
-- owner forwards it to the customer). Run by the owner, or by the webhook handler.
create or replace function public.export_customer_data(p_customer_gid text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with u as (select user_id from public.profiles where shopify_customer_id = p_customer_gid)
  select case when not exists (select 1 from u) then null else jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = (select user_id from u)),
    'consents', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at), '[]') from public.consents c where c.user_id = (select user_id from u)),
    'points_ledger', (select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]') from public.points_ledger l where l.user_id = (select user_id from u)),
    'redemptions', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.points_redemptions r where r.user_id = (select user_id from u)),
    'routines', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.routines x where x.user_id = (select user_id from u)),
    'routine_exercises', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.routine_exercises x where x.user_id = (select user_id from u)),
    'exercises', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.exercises x where x.user_id = (select user_id from u)),
    'workouts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.workouts x where x.user_id = (select user_id from u)),
    'sets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.sets x where x.user_id = (select user_id from u)),
    'stock_items', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from public.stock_items x where x.user_id = (select user_id from u))
  ) end
$$;

-- shop/redact: remove Shopify identifiers app-wide (accounts and training data stay;
-- they belong to the app users, not to the shop installation).
create or replace function public.redact_shop_identifiers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set shopify_customer_id = null where shopify_customer_id is not null;
  update public.points_ledger set reference = null where reason = 'order' and reference is not null;
end;
$$;

-- Service-role grants for Edge Functions.
grant execute on function
  public.shopify_synthetic_email(text),
  public.find_user_for_shopify_customer(text),
  public.link_shopify_customer(uuid, text),
  public.delete_account(uuid, text),
  public.award_order_points(text, text, integer),
  public.redeem_reserve(uuid, uuid, text),
  public.redeem_mark_issued(uuid, text, text, timestamptz),
  public.redeem_mark_failed(uuid),
  public.export_customer_data(text),
  public.redact_shop_identifiers()
to service_role;
revoke execute on function
  public.shopify_synthetic_email(text),
  public.find_user_for_shopify_customer(text),
  public.link_shopify_customer(uuid, text),
  public.delete_account(uuid, text),
  public.award_order_points(text, text, integer),
  public.redeem_reserve(uuid, uuid, text),
  public.redeem_mark_issued(uuid, text, text, timestamptz),
  public.redeem_mark_failed(uuid),
  public.export_customer_data(text),
  public.redact_shop_identifiers()
from public, anon, authenticated;
revoke execute on function public.award_workout_points(uuid) from public, anon;
