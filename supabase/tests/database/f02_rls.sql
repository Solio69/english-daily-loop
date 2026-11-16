-- Owner-run only. Supabase CLI pg_prove wraps this file in a rollback transaction.
-- The fixture is synthetic and must never remain in the working local DB.

do $$
begin
  if current_database() <> 'postgres' then
    raise exception 'F02 RLS test requires the local postgres database';
  end if;
  if to_regclass('public.users') is null
    or to_regclass('public.support_reports') is null
    or to_regclass('public.user_active_reading_texts') is null then
    raise exception 'F02 RLS test requires current application tables';
  end if;
  if exists (
    select 1 from public.users
    where id = 'f0200000-0000-4000-8000-000000000001'::uuid
       or telegram_user_id = 999990002
  ) then
    raise exception 'F02 fixture identifier is already in use';
  end if;
end;
$$;

create extension if not exists pgtap with schema extensions;
set search_path to public, extensions;

select plan(11);

insert into public.users (id, telegram_user_id, first_name, created_at)
values (
  'f0200000-0000-4000-8000-000000000001',
  999990002,
  'F02 Fixture',
  '2026-10-14T00:00:00Z'
);

select is(
  (select count(*)::integer from public.users where telegram_user_id = 999990002),
  1,
  'synthetic fixture exists only inside the test transaction'
);
select ok((select relrowsecurity from pg_class where oid = 'public.users'::regclass), 'users RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.support_reports'::regclass), 'support reports RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.user_active_reading_texts'::regclass), 'active reading texts RLS enabled');
select ok(not has_table_privilege('anon', 'public.users', 'select'), 'anon cannot select users');
select ok(not has_table_privilege('authenticated', 'public.users', 'select'), 'authenticated cannot select users');
select ok(not has_table_privilege('anon', 'public.support_reports', 'select'), 'anon cannot select support reports');
select ok(not has_table_privilege('authenticated', 'public.support_reports', 'select'), 'authenticated cannot select support reports');
select ok(not has_table_privilege('anon', 'public.user_active_reading_texts', 'select'), 'anon cannot select active reading texts');
select ok(not has_table_privilege('authenticated', 'public.user_active_reading_texts', 'select'), 'authenticated cannot select active reading texts');
select ok(has_table_privilege('service_role', 'public.users', 'select'), 'service role retains server-only access');

select * from finish();
