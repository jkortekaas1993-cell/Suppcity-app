\ir 00_helpers.sql
-- Account linking, deletion cascade, consents, Shopify GDPR helpers, retention.
set role service_role;
select tests.service();
select tests.eq(public.shopify_synthetic_email('gid://shopify/Customer/42'), 'shopify-42@auth.suppcity.nl', 'synthetic email');
select tests.eq(public.find_user_for_shopify_customer('gid://shopify/Customer/1001'), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'find by profile link');
reset role;
insert into auth.users (id, email) values ('eeeeeeee-0000-0000-0000-000000000005', 'shopify-42@auth.suppcity.nl');
set role service_role;
select tests.eq(public.find_user_for_shopify_customer('gid://shopify/Customer/42'), 'eeeeeeee-0000-0000-0000-000000000005'::uuid, 'find by synthetic email (repair path)');
select public.link_shopify_customer('eeeeeeee-0000-0000-0000-000000000005', 'gid://shopify/Customer/42');
select public.link_shopify_customer('eeeeeeee-0000-0000-0000-000000000005', 'gid://shopify/Customer/42');
select tests.eq((select shopify_customer_id from public.profiles where user_id = 'eeeeeeee-0000-0000-0000-000000000005'), 'gid://shopify/Customer/42', 'link is idempotent');
select tests.throws($$select public.link_shopify_customer('eeeeeeee-0000-0000-0000-000000000005', '1 or 1=1')$$, '%invalid Shopify%', 'gid validated');
select tests.throws($$select public.link_shopify_customer('eeeeeeee-0000-0000-0000-000000000005', 'gid://shopify/Customer/1001')$$, '%duplicate key%', 'one customer cannot link two users');
reset role;

-- consents
set role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.set_consent('marketing_email', true, '2026-10');
select pg_sleep(0.01);
select public.set_consent('marketing_email', false, '2026-10');
select public.set_consent('health_sync', true, '2026-10');
select tests.eq((select granted from public.current_consents where consent_type = 'marketing_email'), false, 'latest consent event wins');
select tests.eq((select count(*) from public.consents), 3::bigint, 'consent log appends');
select tests.throws($$select public.set_consent('sell_my_soul', true, '2026-10')$$, '%check constraint%', 'unknown consent type refused');
select tests.throws($$select public.set_consent('analytics', true, '')$$, '%policy_version%', 'policy version required');
insert into public.consents (user_id, consent_type, granted, policy_version, created_at) values (auth.uid(), 'analytics', true, '2026-10', '2000-01-01');
select tests.ok((select created_at > '2026-01-01' from public.consents where consent_type = 'analytics'), 'server sets consent timestamp (no backdating)');
select tests.throws($$update public.consents set granted = true$$, '%permission denied%|%0 rows%', 'consents not updatable') where false;
update public.consents set granted = true;
select tests.eq((select count(*) from public.consents where consent_type = 'marketing_email' and granted), 1::bigint, 'update has no effect (no policy)');
delete from public.consents;
select tests.eq((select count(*) from public.consents), 4::bigint, 'delete has no effect (no policy)');
select tests.login('cccccccc-0000-0000-0000-000000000003');
select tests.eq((select count(*) from public.current_consents), 0::bigint, 'other user sees no consents');
reset role;

-- data request export + delete cascade
insert into public.workouts (id, user_id, title, started_at) values ('77777777-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 't', now());
insert into public.sets (id, user_id, workout_id, exercise_id, position) values ('77777777-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '77777777-0000-0000-0000-000000000001', 'squat-barbell', 0);
select public.award_order_points('gid://shopify/Customer/1001', 'gid://shopify/Order/1', 10);
set role service_role;
select tests.eq(jsonb_array_length(public.export_customer_data('gid://shopify/Customer/1001')->'workouts'), 1, 'export contains workouts');
select tests.ok(public.export_customer_data('gid://shopify/Customer/9999') is null, 'export of unknown customer is null');
select tests.ok(public.delete_account('aaaaaaaa-0000-0000-0000-000000000001', 'user_request') is not null, 'delete returns confirmation id');
select tests.ok(public.delete_account('aaaaaaaa-0000-0000-0000-000000000001', 'user_request') is null, 'second delete is a no-op');
reset role;
select tests.eq((select count(*) from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'auth user gone');
select tests.eq((select count(*) from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*) from public.consents where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*) from public.workouts where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*) from public.sets where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*) from public.points_ledger where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'all user data cascaded');
select tests.eq((select count(*) from public.account_deletions), 1::bigint, 'one anonymous deletion log row');
select tests.eq((select count(*) from information_schema.columns where table_name = 'account_deletions'), 3::bigint, 'deletion log has no identifying columns');

-- shop/redact (as the Edge Function: service_role JWT)
set role service_role;
select tests.service();
select public.award_order_points('gid://shopify/Customer/1003', 'gid://shopify/Order/2', 10);
select public.redact_shop_identifiers();
reset role;
select tests.eq((select count(*) from public.profiles where shopify_customer_id is not null), 0::bigint, 'shop/redact clears customer ids');
select tests.eq((select count(*) from public.points_ledger where reference like 'gid://shopify/Order/%'), 0::bigint, 'shop/redact clears order refs');
select tests.eq((select balance from public.points_balance where user_id = 'cccccccc-0000-0000-0000-000000000003'), 10, 'points kept after redaction');

-- retention
insert into public.workouts (id, user_id, title, started_at, deleted_at) values
  ('66666666-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000003', 'old del', now(), now() - interval '31 days'),
  ('66666666-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003', 'new del', now(), now() - interval '29 days'),
  ('66666666-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003', 'live', now(), null);
insert into public.consents (user_id, consent_type, granted, policy_version) values ('cccccccc-0000-0000-0000-000000000003', 'analytics', true, 'v1');
insert into public.consents (user_id, consent_type, granted, policy_version) values ('cccccccc-0000-0000-0000-000000000003', 'analytics', false, 'v1');
alter table public.consents disable trigger consents_server_timestamp;
update public.consents set created_at = now() - interval '6 years' where user_id = 'cccccccc-0000-0000-0000-000000000003';
update public.consents set created_at = created_at + interval '1 day' where user_id = 'cccccccc-0000-0000-0000-000000000003' and not granted;
alter table public.consents enable trigger consents_server_timestamp;
update auth.users set last_sign_in_at = now() - interval '3 years' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update auth.users set last_sign_in_at = now() - interval '2 years' + interval '10 days' where id = 'eeeeeeee-0000-0000-0000-000000000005';
update auth.users set last_sign_in_at = now() where id = 'cccccccc-0000-0000-0000-000000000003';

set role service_role;
select tests.eq((public.run_retention()->>'workouts')::int, 1, 'retention purges soft-deleted > 30 days');
reset role;
select tests.eq((select count(*) from public.workouts where user_id = 'cccccccc-0000-0000-0000-000000000003'), 2::bigint, 'recent soft delete and live row kept');
select tests.eq((select count(*) from public.consents where user_id = 'cccccccc-0000-0000-0000-000000000003'), 1::bigint, 'old consents purged except current state');
select tests.eq((select granted from public.current_consents where user_id = 'cccccccc-0000-0000-0000-000000000003'), false, 'current consent state preserved');
select tests.eq((select count(*) from public.retention_notices), 2::bigint, 'notices for inactive (B) and nearly inactive (E)');
select tests.eq((select count(*) from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1::bigint, 'no deletion before notice period');
update public.retention_notices set notice_created_at = now() - interval '31 days';
update auth.users set last_sign_in_at = now() where id = 'eeeeeeee-0000-0000-0000-000000000005';
set role service_role;
select tests.eq((public.run_retention()->>'accounts_deleted')::int, 1, 'inactive account deleted after notice');
reset role;
select tests.eq((select count(*) from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'inactive user B deleted');
select tests.eq((select count(*) from auth.users where id = 'eeeeeeee-0000-0000-0000-000000000005'), 1::bigint, 'sign-in after notice cancels deletion');
select tests.eq((select count(*) from public.retention_notices), 0::bigint, 'notices cleaned up');
select tests.eq((select count(*) from public.account_deletions where reason = 'inactivity'), 1::bigint, 'inactivity deletion logged anonymously');
