\ir 00_helpers.sql
-- Sync write semantics (0002) + RLS on tracker tables.
set role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');

insert into public.workouts (id, title, started_at, updated_at)
values ('11111111-0000-0000-0000-000000000001', 'v1', '2026-10-12 10:00+00', '2026-10-12 10:00+00');
select tests.eq((select updated_at from public.workouts where id = '11111111-0000-0000-0000-000000000001'),
  '2026-10-12 10:00+00'::timestamptz, 'client updated_at is kept (not overwritten by trigger)');
select tests.eq((select user_id from public.workouts where id = '11111111-0000-0000-0000-000000000001'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'user_id defaults to auth.uid()');

create temp table cur as select server_updated_at s from public.workouts where id = '11111111-0000-0000-0000-000000000001';

-- newer write wins
insert into public.workouts (id, title, started_at, updated_at)
values ('11111111-0000-0000-0000-000000000001', 'v2', '2026-10-12 10:00+00', '2026-10-12 11:00+00')
on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
select tests.eq((select title from public.workouts where id = '11111111-0000-0000-0000-000000000001'), 'v2', 'newer write wins');
select tests.ok((select server_updated_at from public.workouts where id = '11111111-0000-0000-0000-000000000001') > (select s from cur), 'server_updated_at advances');

-- stale write ignored
insert into public.workouts (id, title, started_at, updated_at)
values ('11111111-0000-0000-0000-000000000001', 'old', '2026-10-12 10:00+00', '2026-10-12 10:30+00')
on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
select tests.eq((select title from public.workouts where id = '11111111-0000-0000-0000-000000000001'), 'v2', 'stale write ignored');

-- identical replay does not bump the pull cursor
update cur set s = (select server_updated_at from public.workouts where id = '11111111-0000-0000-0000-000000000001');
insert into public.workouts (id, title, started_at, updated_at)
values ('11111111-0000-0000-0000-000000000001', 'v2', '2026-10-12 10:00+00', '2026-10-12 11:00+00')
on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
select tests.eq((select server_updated_at from public.workouts where id = '11111111-0000-0000-0000-000000000001'), (select s from cur), 'identical replay is a no-op');

-- stale soft delete still deletes, content stays
insert into public.workouts (id, title, started_at, updated_at, deleted_at)
values ('11111111-0000-0000-0000-000000000001', 'stale', '2026-10-12 10:00+00', '2026-10-12 10:45+00', '2026-10-12 10:45+00')
on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
select tests.ok((select deleted_at is not null and title = 'v2' from public.workouts where id = '11111111-0000-0000-0000-000000000001'), 'stale delete is sticky, content kept');

-- newer non-delete cannot undelete
insert into public.workouts (id, title, started_at, updated_at, deleted_at)
values ('11111111-0000-0000-0000-000000000001', 'v3', '2026-10-12 10:00+00', '2026-10-12 12:00+00', null)
on conflict (id) do update set title = excluded.title, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at;
select tests.ok((select deleted_at is not null and title = 'v3' from public.workouts where id = '11111111-0000-0000-0000-000000000001'), 'never undelete');

-- user_id/created_at immutable; RLS isolation
select tests.throws($$update public.workouts set user_id = 'cccccccc-0000-0000-0000-000000000003', updated_at = now() where id = '11111111-0000-0000-0000-000000000001'$$,
  '%user_id is immutable%', 'cannot move a row to another user');
select tests.throws($$insert into public.workouts (id, user_id, title, started_at) values (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000003', 'x', now())$$,
  '%row-level security%', 'cannot insert for another user');

insert into public.sets (id, workout_id, exercise_id, position, weight_kg, reps, updated_at)
values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'squat-barbell', 0, 100, 5, '2026-10-12 10:10+00');

select tests.login('cccccccc-0000-0000-0000-000000000003');
select tests.eq((select count(*) from public.workouts), 0::bigint, 'other user sees no workouts');
select tests.eq((select count(*) from public.sets), 0::bigint, 'other user sees no sets');
-- upsert on a foreign id: conflict row is invisible → RLS error, no takeover
select tests.throws($$insert into public.workouts (id, title, started_at, updated_at) values ('11111111-0000-0000-0000-000000000001', 'hijack', now(), now() + interval '1 day') on conflict (id) do update set title = excluded.title$$,
  '%row-level security%', 'cannot hijack a foreign id via upsert');

reset role;
set role anon;
select tests.throws($$select * from public.workouts$$, '%permission denied%', 'anon has no table access');
reset role;
select tests.eq((select title from public.workouts where id = '11111111-0000-0000-0000-000000000001'), 'v3', 'foreign row untouched');
