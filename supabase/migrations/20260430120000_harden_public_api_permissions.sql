-- Security hardening for the public API surface.
-- The app uses Telegram initData validation in Edge Functions instead of
-- direct Supabase Auth sessions, so protected data must stay server-only.

revoke create on schema public from public;
revoke create on schema public from anon;
revoke create on schema public from authenticated;

revoke all on table public.users
from anon, authenticated;

revoke all on table public.user_settings
from anon, authenticated;

revoke all on table public.reading_generation_attempts
from anon, authenticated;

revoke all on table public.user_active_reading_texts
from anon, authenticated;

revoke all on table public.user_daily_reading_completions
from anon, authenticated;

revoke all on table public.user_completed_reading_texts
from anon, authenticated;

revoke all on table public.user_subscriptions
from anon, authenticated;

grant all on table public.users
to service_role;

grant all on table public.user_settings
to service_role;

grant all on table public.reading_generation_attempts
to service_role;

grant all on table public.user_active_reading_texts
to service_role;

grant all on table public.user_daily_reading_completions
to service_role;

grant all on table public.user_completed_reading_texts
to service_role;

grant all on table public.user_subscriptions
to service_role;

revoke all on function public.get_random_reading_text(text)
from public, anon, authenticated;

grant execute on function public.get_random_reading_text(text)
to service_role;

revoke all on function public.set_updated_at()
from public, anon, authenticated;

