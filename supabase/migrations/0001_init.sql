-- 0001_init.sql — Supp City app foundation schema.
-- Region: EU. Every table has RLS enabled with owner-only policies (hard rule 6).
-- Append-only: never edit a migration that has been applied; add 0002_..., 0003_...

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, linked to the Shopify customer.
-- shopify_customer_id is written ONLY by the shopify-auth-exchange Edge Function
-- (service role) after verifying the Customer Account token server-side.
-- No body/health data here (hard rule 1).
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  shopify_customer_id text unique,
  display_name text,
  adult_confirmed_at timestamptz,          -- 18+ self-declaration, required for points (hard rule 5)
  pt_code text,                            -- linked personal trainer code
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Clients may not change their own Shopify link.
create or replace function public.profiles_protect_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' and new.shopify_customer_id is distinct from old.shopify_customer_id then
    raise exception 'shopify_customer_id can only be set server-side';
  end if;
  return new;
end;
$$;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.profiles_protect_columns();

-- ---------------------------------------------------------------------------
-- consents: append-only event log, one row per grant/revoke (hard rule 2).
-- Current state = latest row per (user_id, consent_type), see view below.
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type text not null check (consent_type in
    ('marketing_email', 'marketing_push', 'health_sync', 'analytics', 'pt_share')),
  granted boolean not null,
  policy_version text not null,
  source text not null default 'app' check (source in ('app', 'web')),
  created_at timestamptz not null default now()
);
create index consents_user_type_idx on public.consents (user_id, consent_type, created_at desc);

create view public.current_consents
with (security_invoker = true) as
select distinct on (user_id, consent_type)
  user_id, consent_type, granted, policy_version, created_at
from public.consents
order by user_id, consent_type, created_at desc;

-- ---------------------------------------------------------------------------
-- Tracker tables (mirror src/lib/db/schema.ts). Client-generated UUIDs,
-- soft deletes for sync. user_id defaults to the caller.
-- ---------------------------------------------------------------------------
create table public.exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text,
  name_nl text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  is_custom boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
-- Only user-created exercises are synced; the built-in library ships in the app bundle.

create table public.routines (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  notes text,
  program_slug text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.routine_exercises (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  exercise_id text not null,               -- uuid of a custom exercise OR slug of a built-in one
  position integer not null,
  target_sets integer not null default 3 check (target_sets > 0),
  target_reps_min integer,
  target_reps_max integer,
  rest_seconds integer not null default 90 check (rest_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id, position);

create table public.workouts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  title text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  notes text,
  source text not null default 'app' check (source in ('app', 'import_hevy', 'import_strong')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

create table public.sets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id text not null,               -- uuid of a custom exercise OR slug of a built-in one
  position integer not null,
  set_type text not null default 'normal' check (set_type in ('warmup', 'normal', 'dropset', 'failure')),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg >= 0),
  reps integer check (reps is null or reps >= 0),
  rpe numeric(3, 1) check (rpe is null or (rpe >= 1 and rpe <= 10)),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index sets_workout_idx on public.sets (workout_id, position);

-- Sync cursors: pull by (user_id, updated_at).
create index exercises_sync_idx on public.exercises (user_id, updated_at);
create index routines_sync_idx on public.routines (user_id, updated_at);
create index routine_exercises_sync_idx on public.routine_exercises (user_id, updated_at);
create index workouts_sync_idx on public.workouts (user_id, updated_at);
create index sets_sync_idx on public.sets (user_id, updated_at);

create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();
create trigger routines_updated_at before update on public.routines
  for each row execute function public.set_updated_at();
create trigger routine_exercises_updated_at before update on public.routine_exercises
  for each row execute function public.set_updated_at();
create trigger workouts_updated_at before update on public.workouts
  for each row execute function public.set_updated_at();
create trigger sets_updated_at before update on public.sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- points_ledger: append-only, written ONLY by the server (service role).
-- Users can read their own entries. Rules (hard rule 5): no randomness,
-- max 3 rewarded workouts per ISO week, 18+ only. Never fed by health data (rule 1).
-- ---------------------------------------------------------------------------
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('order', 'workout', 'redeem', 'adjustment', 'expiry')),
  points integer not null,
  reference text,                          -- Shopify order id, workout id, discount code...
  iso_week text,                           -- e.g. '2026-W42', required for reason = 'workout'
  created_at timestamptz not null default now(),
  constraint points_workout_needs_week check (reason <> 'workout' or iso_week is not null),
  constraint points_reference_unique unique (user_id, reason, reference)  -- idempotent webhooks
);
create index points_ledger_user_idx on public.points_ledger (user_id, created_at desc);

create or replace function public.points_ledger_guard()
returns trigger
language plpgsql
as $$
declare
  rewarded integer;
begin
  if new.reason in ('order', 'workout') and not exists (
    select 1 from public.profiles p
    where p.user_id = new.user_id and p.adult_confirmed_at is not null and p.deleted_at is null
  ) then
    raise exception 'points require a confirmed 18+ profile';
  end if;

  if new.reason = 'workout' then
    -- serialize concurrent inserts for the same user+week so the cap cannot be raced
    perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':' || new.iso_week));
    select count(*) into rewarded
    from public.points_ledger
    where user_id = new.user_id and reason = 'workout' and iso_week = new.iso_week;
    if rewarded >= 3 then
      raise exception 'weekly workout points cap reached for %', new.iso_week;
    end if;
  end if;
  return new;
end;
$$;
create trigger points_ledger_guard before insert on public.points_ledger
  for each row execute function public.points_ledger_guard();

create view public.points_balance
with (security_invoker = true) as
select user_id, coalesce(sum(points), 0)::integer as balance
from public.points_ledger
group by user_id;

-- ---------------------------------------------------------------------------
-- stock_items: smart supply counter ("slimme voorraadteller").
-- ---------------------------------------------------------------------------
create table public.stock_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  shopify_variant_id text,
  product_title text not null,
  servings_total integer not null check (servings_total > 0),
  servings_per_day numeric(4, 1) not null default 1 check (servings_per_day > 0),
  opened_at date not null default current_date,
  remind_days_before integer not null default 7 check (remind_days_before >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index stock_items_sync_idx on public.stock_items (user_id, updated_at);
create trigger stock_items_updated_at before update on public.stock_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: ON for every table. Policies: user_id = auth.uid().
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.sets enable row level security;
alter table public.points_ledger enable row level security;
alter table public.stock_items enable row level security;

-- profiles: read/update own row; rows are created server-side by shopify-auth-exchange.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- consents: append-only for the owner (no update/delete policies => denied).
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- points_ledger: read-only for the owner; inserts only via service role.
create policy points_select_own on public.points_ledger
  for select to authenticated using (user_id = (select auth.uid()));

-- Owner-only full access for tracker + stock tables.
do $$
declare
  t text;
begin
  foreach t in array array['exercises', 'routines', 'routine_exercises', 'workouts', 'sets', 'stock_items']
  loop
    execute format(
      'create policy %1$s_owner_all on public.%1$I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- No grants to anon on any table: logged-out users work purely locally.
revoke all on all tables in schema public from anon;
