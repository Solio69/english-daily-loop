create table if not exists public.reading_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  attempt_date date not null,
  status text not null default 'started',
  provider text,
  model text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_generation_attempts_status_check
    check (status in ('started', 'succeeded', 'failed'))
);

drop trigger if exists trg_reading_generation_attempts_set_updated_at on public.reading_generation_attempts;
create trigger trg_reading_generation_attempts_set_updated_at
before update on public.reading_generation_attempts
for each row
execute function public.set_updated_at();

create index if not exists idx_reading_generation_attempts_user_date
  on public.reading_generation_attempts (user_id, attempt_date);

alter table public.reading_generation_attempts enable row level security;

create table if not exists public.user_active_reading_texts (
  user_id uuid primary key references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  level text not null,
  estimated_minutes int not null,
  provider text not null,
  model text not null,
  fallback_used boolean not null default false,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_active_reading_texts_level_check check (level in ('A1', 'A2', 'B1', 'B2')),
  constraint user_active_reading_texts_estimated_minutes_check check (estimated_minutes in (3, 5, 10, 15))
);

drop trigger if exists trg_user_active_reading_texts_set_updated_at on public.user_active_reading_texts;
create trigger trg_user_active_reading_texts_set_updated_at
before update on public.user_active_reading_texts
for each row
execute function public.set_updated_at();

alter table public.user_active_reading_texts enable row level security;

create table if not exists public.user_daily_reading_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  completed_date date not null,
  completed_at timestamptz not null default now(),
  constraint user_daily_reading_completions_user_date_unique unique (user_id, completed_date)
);

create index if not exists idx_user_daily_reading_completions_user_date
  on public.user_daily_reading_completions (user_id, completed_date);

alter table public.user_daily_reading_completions enable row level security;
