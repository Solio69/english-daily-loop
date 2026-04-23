alter table public.user_settings
  add column if not exists daily_reading_minutes int not null default 3;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_daily_reading_minutes_check'
  ) then
    alter table public.user_settings
      add constraint user_settings_daily_reading_minutes_check
      check (daily_reading_minutes in (3, 5, 10, 15));
  end if;
end;
$$;
