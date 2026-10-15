\ir 00_helpers.sql
-- PT code (0005): own row only, format enforced, Shopify link stays server-only.
set role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
update public.profiles set pt_code = 'PT1234' where user_id = auth.uid();
select tests.eq((select pt_code from public.profiles where user_id = auth.uid()), 'PT1234', 'user links own PT code');
select tests.throws($$update public.profiles set pt_code = 'bad-code!' where user_id = auth.uid()$$, '%profiles_pt_code_format%', 'malformed PT code refused');
update public.profiles set pt_code = 'HACK' where user_id = 'cccccccc-0000-0000-0000-000000000003';
reset role;
select tests.eq((select pt_code from public.profiles where user_id = 'cccccccc-0000-0000-0000-000000000003'), null::text, 'RLS: cannot set another user''s PT code');
set role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
update public.profiles set pt_code = null where user_id = auth.uid();
select tests.eq((select pt_code from public.profiles where user_id = auth.uid()), null::text, 'user unlinks PT code');
select tests.throws($$update public.profiles set shopify_customer_id = 'gid://shopify/Customer/9' where user_id = auth.uid()$$, '%server-side%', 'Shopify link still protected');
reset role;
