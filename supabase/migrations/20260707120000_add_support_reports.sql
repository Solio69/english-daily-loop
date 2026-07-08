create table if not exists public.support_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_user_id bigint not null,
  app_role text not null,
  current_screen text not null,
  user_comment text not null,
  app_context jsonb not null default '{}'::jsonb,
  events jsonb not null default '[]'::jsonb,
  request_ids text[] not null default '{}'::text[],
  ai_diagnostics jsonb not null default '[]'::jsonb,
  report_date date not null default ((now() at time zone 'Europe/Moscow')::date),
  created_at timestamptz not null default now(),
  constraint support_reports_app_role_check
    check (app_role in ('admin', 'tester', 'user')),
  constraint support_reports_user_comment_check
    check (length(trim(user_comment)) > 0),
  constraint support_reports_events_array_check
    check (jsonb_typeof(events) = 'array'),
  constraint support_reports_ai_diagnostics_array_check
    check (jsonb_typeof(ai_diagnostics) = 'array')
);

create index if not exists idx_support_reports_user_created_at
  on public.support_reports (user_id, created_at desc);

create index if not exists idx_support_reports_report_date
  on public.support_reports (report_date desc);

create index if not exists idx_support_reports_request_ids
  on public.support_reports using gin (request_ids);

alter table public.support_reports enable row level security;

revoke all on table public.support_reports
from anon, authenticated;

grant all on table public.support_reports
to service_role;

create extension if not exists pg_cron
with schema pg_catalog;

select cron.schedule(
  'cleanup_support_reports',
  '35 3 * * *',
  $$
    delete from public.support_reports
    where created_at < now() - interval '30 days';
  $$
);
