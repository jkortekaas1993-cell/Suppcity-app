-- Included by each *.test.sql (\ir). Assertion helpers; run as superuser, usable by any role.
create schema tests;
grant usage on schema tests to public;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERT FAILED: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;

create function tests.eq(got anyelement, want anyelement, msg text) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'ASSERT FAILED: % (got %, want %)', msg, got, want; end if;
  raise notice 'ok - %', msg;
end $$;

-- Runs sql and asserts it raises an error whose message matches pattern (ILIKE).
create function tests.throws(sql text, pattern text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm ilike pattern then raise notice 'ok - %', msg; return; end if;
    raise exception 'ASSERT FAILED: % (wrong error: %)', msg, sqlerrm;
  end;
  raise exception 'ASSERT FAILED: % (no error raised)', msg;
end $$;

-- Switch identity like PostgREST does.
create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', uid::text, false),
         set_config('request.jwt.claim.role', 'authenticated', false);
$$;
create function tests.service() returns void language sql as $$
  select set_config('request.jwt.claim.sub', '', false),
         set_config('request.jwt.claim.role', 'service_role', false);
$$;
grant execute on all functions in schema tests to public;

-- Fixtures: A adult, B minor, C adult (other user).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x.test'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@x.test');
insert into public.profiles (user_id, shopify_customer_id, adult_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'gid://shopify/Customer/1001', now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'gid://shopify/Customer/1002', null),
  ('cccccccc-0000-0000-0000-000000000003', 'gid://shopify/Customer/1003', now());
