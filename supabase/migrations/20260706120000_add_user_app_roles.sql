alter table public.users
add column if not exists app_role text not null default 'tester';

alter table public.users
drop constraint if exists users_app_role_check;

alter table public.users
add constraint users_app_role_check
  check (app_role in ('admin', 'tester', 'user'));

comment on column public.users.app_role is
  'Application role for internal access control: admin, tester, or user.';
