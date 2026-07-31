alter table public.reading_texts
enable row level security;

revoke all on table public.reading_texts
from public, anon, authenticated;

grant all on table public.reading_texts
to service_role;
