\ir 00_helpers.sql
-- 0006: 18+ only via confirm_adult(), protected profile columns, clock cap, redemption sweep, consent source.

-- H2: the reviewer's exploit (supabase review proof.sql) must fail.
set role authenticated;
select tests.login('bbbbbbbb-0000-0000-0000-000000000002');
select tests.throws($$update public.profiles set adult_confirmed_at = now() - interval '1 year' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  '%confirm_adult%', 'client cannot self-confirm 18+ with a backdated timestamp');
select tests.throws($$update public.profiles set deleted_at = now() where user_id = auth.uid()$$, '%server-side%', 'client cannot set deleted_at');
select tests.ok((select adult_confirmed_at is null from public.profiles), 'minor profile still unconfirmed');
insert into public.workouts (id, title, started_at, ended_at, source, updated_at)
select gen_random_uuid(), 'fake', now() - interval '20 minutes', now(), 'app', now() from generate_series(1, 5);
select tests.eq((select count(*) from public.workouts w where public.award_workout_points(w.id) = 'not_adult'), 5::bigint,
  'unconfirmed user earns no workout points');
select tests.eq((select coalesce(sum(points), 0)::int from public.points_ledger), 0, 'no points farmed');

-- confirm_adult(): server timestamp, once, idempotent
select tests.ok(public.confirm_adult() between now() - interval '1 minute' and now() + interval '1 minute', 'confirm_adult sets server time');
select tests.eq(public.confirm_adult(), (select adult_confirmed_at from public.profiles), 'second call keeps the first timestamp');
select tests.throws($$update public.profiles set adult_confirmed_at = null where user_id = auth.uid()$$, '%confirm_adult%', 'client cannot clear the confirmation');
update public.profiles set pt_code = 'PT9999' where user_id = auth.uid();
select tests.eq((select pt_code from public.profiles), 'PT9999', 'other own columns stay editable');
reset role;
set role anon;
select tests.throws($$select public.confirm_adult()$$, '%permission denied%', 'anon cannot call confirm_adult');
reset role;

-- service role (Edge Functions) can still manage the columns
set role service_role;
select tests.service();
update public.profiles set adult_confirmed_at = null where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select tests.ok((select adult_confirmed_at is null from public.profiles where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'service role may reset 18+');
reset role;

-- M3: client clock capped at now() + 5 minutes
set role authenticated;
select tests.login('cccccccc-0000-0000-0000-000000000003');
insert into public.workouts (id, title, started_at, source, updated_at, deleted_at)
values ('66666666-0000-0000-0000-000000000001', 'future', now(), 'app', '2099-01-01', '2099-01-01');
select tests.ok((select updated_at <= now() + interval '5 minutes' from public.workouts where id = '66666666-0000-0000-0000-000000000001'),
  'future updated_at capped on insert');
select tests.ok((select deleted_at <= now() + interval '5 minutes' from public.workouts where id = '66666666-0000-0000-0000-000000000001'),
  'future deleted_at capped');
insert into public.workouts (id, title, started_at, source, updated_at) values ('66666666-0000-0000-0000-000000000002', 'a', now(), 'app', now());
update public.workouts set title = 'b', updated_at = '2099-01-01' where id = '66666666-0000-0000-0000-000000000002';
select tests.ok((select updated_at <= now() + interval '5 minutes' and title = 'b' from public.workouts where id = '66666666-0000-0000-0000-000000000002'),
  'future updated_at capped on update');

-- Low: consents.source is 'app' for clients
select tests.throws($$insert into public.consents (user_id, consent_type, granted, policy_version, source) values (auth.uid(), 'analytics', true, 'p', 'web')$$,
  '%row-level security%', 'client cannot log a consent as source web');
reset role;

-- M5: stale pending redemptions are refunded by the sweep
insert into public.points_ledger (user_id, reason, points, reference) values ('cccccccc-0000-0000-0000-000000000003', 'adjustment', 1000, 'topup');
set role service_role;
select tests.service();
select public.redeem_reserve('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-1111-0000-0000-000000000001', 'eur5');
select public.redeem_reserve('cccccccc-0000-0000-0000-000000000003', 'eeeeeeee-1111-0000-0000-000000000002', 'eur5');
reset role;
update public.points_redemptions set created_at = now() - interval '2 hours' where id = 'eeeeeeee-1111-0000-0000-000000000001';
set role service_role;
select tests.eq(public.redeem_expire_stale(), 1, 'one stale redemption swept');
select tests.eq(public.redeem_expire_stale(), 0, 'sweep is idempotent');
select tests.eq((select status from public.points_redemptions where id = 'eeeeeeee-1111-0000-0000-000000000001'), 'failed', 'stale one failed');
select tests.eq((select status from public.points_redemptions where id = 'eeeeeeee-1111-0000-0000-000000000002'), 'pending', 'fresh one untouched');
select tests.eq((select balance from public.points_balance where user_id = 'cccccccc-0000-0000-0000-000000000003'), 500, 'stale points refunded once');
reset role;
set role authenticated;
select tests.throws($$select public.redeem_expire_stale()$$, '%permission denied%', 'client cannot call the sweep');
reset role;

-- Low: every function in public has a fixed search_path
select tests.eq((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    and not exists (
    select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0::bigint, 'all public functions pin search_path');
