create table if not exists public.user_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  english_level text not null default 'A1',
  daily_exercise_minutes int not null default 10,
  daily_review_words int not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_level_check check (english_level in ('A1', 'A2', 'B1', 'B2')),
  constraint user_settings_daily_exercise_minutes_check check (daily_exercise_minutes between 5 and 60),
  constraint user_settings_daily_review_words_check check (daily_review_words between 5 and 100)
);

drop trigger if exists trg_user_settings_set_updated_at on public.user_settings;
create trigger trg_user_settings_set_updated_at
before update on public.user_settings
for each row
execute function public.set_updated_at();
