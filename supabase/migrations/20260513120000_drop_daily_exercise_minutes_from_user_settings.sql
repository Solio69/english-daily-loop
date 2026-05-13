alter table public.user_settings
  drop constraint if exists user_settings_daily_exercise_minutes_check,
  drop column if exists daily_exercise_minutes;
