create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan_type text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  source text not null default 'mvp_zero_price',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_subscriptions_plan_type_check
    check (plan_type in ('monthly', 'yearly')),
  constraint user_subscriptions_source_check
    check (source in ('mvp_zero_price')),
  constraint user_subscriptions_time_range_check
    check (ends_at > starts_at)
);

drop trigger if exists trg_user_subscriptions_set_updated_at on public.user_subscriptions;
create trigger trg_user_subscriptions_set_updated_at
before update on public.user_subscriptions
for each row
execute function public.set_updated_at();

create index if not exists idx_user_subscriptions_user_time
  on public.user_subscriptions (user_id, starts_at, ends_at);

create index if not exists idx_user_subscriptions_user_ends_at
  on public.user_subscriptions (user_id, ends_at);

alter table public.user_subscriptions enable row level security;
