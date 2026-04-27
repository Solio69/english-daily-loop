create table if not exists public.user_completed_reading_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  completed_date date not null,
  completed_at timestamptz not null,
  title text not null,
  body text not null,
  level text not null,
  estimated_minutes int not null,
  provider text not null,
  model text not null,
  fallback_used boolean not null default false,
  created_at timestamptz not null default now(),
  constraint user_completed_reading_texts_user_date_unique unique (user_id, completed_date),
  constraint user_completed_reading_texts_level_check check (level in ('A1', 'A2', 'B1', 'B2')),
  constraint user_completed_reading_texts_estimated_minutes_check check (estimated_minutes in (3, 5, 10, 15))
);

create index if not exists idx_user_completed_reading_texts_user_completed
  on public.user_completed_reading_texts (user_id, completed_at desc, id desc);

alter table public.user_completed_reading_texts enable row level security;
