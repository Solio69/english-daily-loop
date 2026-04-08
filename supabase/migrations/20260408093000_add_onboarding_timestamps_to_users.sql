alter table public.users
  add column if not exists settings_completed_at timestamptz,
  add column if not exists first_text_completed_at timestamptz;
