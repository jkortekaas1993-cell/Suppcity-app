\ir 00_helpers.sql
-- Points: workout RPC (cap, 18+, idempotent, no health data), orders, append-only, redemption.
insert into public.workouts (id, user_id, title, started_at, ended_at, source) select
  ('99999999-0000-0000-0000-00000000000' || g)::uuid, 'aaaaaaaa-0000-0000-0000-000000000001', 'w' || g,
  now() - interval '1 hour', now() - interval '10 minutes', 'app' from generate_series(1, 5) g;
-- ensure the five workouts fall in one ISO week relative to "now"
update public.workouts set started_at = date_trunc('week', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam' + interval '1 hour',
  ended_at = date_trunc('week', now() at time zone 'Europe/Amsterdam') at time zone 'Europe/Amsterdam' + interval '2 hours';
insert into public.workouts (id, user_id, title, started_at, ended_at, source) values
  ('88888888-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'short', now() - interval '6 minutes', now(), 'app'),
  ('88888888-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'import', now() - interval '1 hour', now(), 'import_hevy'),
  ('88888888-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'open', now() - interval '1 hour', null, 'app'),
  ('88888888-0000-0000-0000-000000000004', 'bbbbbbbb-0000-0000-0000-000000000002', 'minor', now() - interval '1 hour', now(), 'app');

set role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select tests.eq(public.award_workout_points('99999999-0000-0000-0000-000000000001'), 'awarded', 'workout 1 awarded');
select tests.eq(public.award_workout_points('99999999-0000-0000-0000-000000000001'), 'already_awarded', 'same workout is idempotent');
select tests.eq(public.award_workout_points('99999999-0000-0000-0000-000000000002'), 'awarded', 'workout 2 awarded');
select tests.eq(public.award_workout_points('99999999-0000-0000-0000-000000000003'), 'awarded', 'workout 3 awarded');
select tests.eq(public.award_workout_points('99999999-0000-0000-0000-000000000004'), 'weekly_cap', 'workout 4 hits weekly cap');
select tests.eq(public.award_workout_points('88888888-0000-0000-0000-000000000001'), 'not_eligible', 'workout < 10 min not eligible');
select tests.eq(public.award_workout_points('88888888-0000-0000-0000-000000000002'), 'not_eligible', 'imported workout not eligible');
select tests.eq(public.award_workout_points('88888888-0000-0000-0000-000000000003'), 'not_eligible', 'unfinished workout not eligible');
select tests.eq(public.award_workout_points('88888888-0000-0000-0000-000000000004'), 'not_eligible', 'other user''s workout not eligible');
select tests.eq((select balance from public.points_balance), 30, 'balance after 3 workouts = 30');

select tests.login('bbbbbbbb-0000-0000-0000-000000000002');
select tests.eq(public.award_workout_points('88888888-0000-0000-0000-000000000004'), 'not_adult', 'minor gets no workout points');

-- client cannot write the ledger or call service functions
select tests.throws($$insert into public.points_ledger (user_id, reason, points, reference) values (auth.uid(), 'adjustment', 999, 'x')$$, '%row-level security%', 'client cannot insert points');
select tests.throws($$select public.award_order_points('gid://shopify/Customer/1002', 'gid://shopify/Order/1', 100)$$, '%permission denied%', 'client cannot call award_order_points');
select tests.throws($$select public.redeem_reserve(auth.uid(), gen_random_uuid(), 'eur5')$$, '%permission denied%', 'client cannot call redeem_reserve');
select tests.throws($$select public.delete_account(auth.uid(), 'user_request')$$, '%permission denied%', 'client cannot call delete_account');
select tests.throws($$update public.profiles set shopify_customer_id = 'gid://shopify/Customer/9' where user_id = auth.uid()$$, '%server-side%', 'client cannot change shopify link');
reset role;
set role anon;
select tests.throws($$select public.award_workout_points('99999999-0000-0000-0000-000000000005')$$, '%permission denied%', 'anon cannot call award_workout_points');
reset role;

-- trigger guards still hold even for direct service inserts
set role service_role;
select tests.service();
select tests.throws($$insert into public.points_ledger (user_id, reason, points, reference, iso_week) values ('aaaaaaaa-0000-0000-0000-000000000001', 'workout', 10, 'direct', to_char(now(), 'IYYY-"W"IW'))$$,
  '%cap reached%', 'direct insert also capped by trigger');
select tests.throws($$insert into public.points_ledger (user_id, reason, points, reference) values ('aaaaaaaa-0000-0000-0000-000000000001', 'redeem', 50, 'r')$$,
  '%points_sign_per_reason%', 'redeem must be negative');

-- orders
select tests.eq(public.award_order_points('gid://shopify/Customer/1001', 'gid://shopify/Order/5001', 57), 'awarded', 'order points awarded');
select tests.eq(public.award_order_points('gid://shopify/Customer/1001', 'gid://shopify/Order/5001', 57), 'duplicate', 'order webhook replay is idempotent');
select tests.eq(public.award_order_points('gid://shopify/Customer/1002', 'gid://shopify/Order/5002', 40), 'not_adult', 'minor gets no order points');
select tests.eq(public.award_order_points('gid://shopify/Customer/7777', 'gid://shopify/Order/5003', 40), 'no_user', 'unknown customer ignored');
select tests.eq(public.award_order_points('gid://shopify/Customer/1001', 'gid://shopify/Order/5004', 0), 'zero', 'zero points ignored');
select tests.eq((select balance from public.points_balance where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 87, 'balance = 30 + 57');

-- append-only, even for service role
select tests.throws($$update public.points_ledger set points = 9999 where reason = 'order'$$, '%append-only%', 'ledger update blocked');
select tests.throws($$delete from public.points_ledger$$, '%append-only%', 'ledger delete blocked');

-- redemption
reset role;
insert into public.points_ledger (user_id, reason, points, reference) values ('aaaaaaaa-0000-0000-0000-000000000001', 'adjustment', 913, 'test-topup');
set role service_role;
select tests.throws($$select public.redeem_reserve('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'eur30')$$, '%insufficient_points%', 'insufficient balance refused');
select tests.throws($$select public.redeem_reserve('aaaaaaaa-0000-0000-0000-000000000001', gen_random_uuid(), 'nope')$$, '%unknown_tier%', 'unknown tier refused');
select tests.eq((public.redeem_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'eur5')->>'status'), 'pending', 'reserve eur5');
select tests.eq((public.redeem_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', 'eur5')->>'status'), 'pending', 'reserve replay idempotent');
select tests.eq((select balance from public.points_balance where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 500, 'balance 1000 - 500 (debited once)');
select tests.throws($$select public.redeem_reserve('cccccccc-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'eur5')$$, '%another user%', 'redemption id cannot be reused by another user');
select tests.eq((public.redeem_mark_issued('dddddddd-0000-0000-0000-000000000001', 'SC-ABCD-EFGH', 'gid://shopify/DiscountCodeNode/1', now() + interval '90 days')->>'status'), 'issued', 'mark issued');
select public.redeem_mark_failed('dddddddd-0000-0000-0000-000000000001');
select tests.eq((select balance from public.points_balance where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 500, 'issued redemption cannot be refunded');

select public.redeem_reserve('aaaaaaaa-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'eur5');
select tests.eq((select balance from public.points_balance where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0, 'second reservation debits');
select public.redeem_mark_failed('dddddddd-0000-0000-0000-000000000002');
select public.redeem_mark_failed('dddddddd-0000-0000-0000-000000000002');
select tests.eq((select balance from public.points_balance where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 500, 'failed redemption refunded exactly once');
reset role;

-- user sees own redemptions and tiers only
set role authenticated;
select tests.login('cccccccc-0000-0000-0000-000000000003');
select tests.eq((select count(*) from public.points_redemptions), 0::bigint, 'other user sees no redemptions');
select tests.eq((select count(*) from public.points_redeem_tiers), 3::bigint, 'tiers readable');
select tests.throws($$insert into public.points_redeem_tiers (id, points, value_cents) values ('free', 1, 10000)$$, '%row-level security%', 'tiers not writable');
