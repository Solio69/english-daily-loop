create table if not exists public.reading_texts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  level text not null,
  tier text not null,
  body text not null,
  estimated_minutes int not null default 3,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reading_texts_level_check check (level in ('A1', 'A2', 'B1', 'B2')),
  constraint reading_texts_tier_check check (tier in ('my_level', 'one_level_up'))
);

drop trigger if exists trg_reading_texts_set_updated_at on public.reading_texts;
create trigger trg_reading_texts_set_updated_at
before update on public.reading_texts
for each row
execute function public.set_updated_at();

create index if not exists idx_reading_texts_tier_active
  on public.reading_texts (tier, is_active);

create index if not exists idx_reading_texts_level_active
  on public.reading_texts (level, is_active);
