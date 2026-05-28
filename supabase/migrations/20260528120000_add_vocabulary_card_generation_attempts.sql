create table if not exists public.vocabulary_card_generation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  attempt_date date not null,
  status text not null default 'started',
  provider text,
  model text,
  prompt_version text,
  model_chain text[],
  requested_count int not null default 0,
  prepared_count int not null default 0,
  failed_count int not null default 0,
  merged_count int not null default 0,
  reactivated_count int not null default 0,
  duration_ms int,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vocabulary_card_generation_attempts_status_check
    check (status in ('started', 'succeeded', 'failed')),
  constraint vocabulary_card_generation_attempts_counts_check
    check (
      requested_count >= 0
      and prepared_count >= 0
      and failed_count >= 0
      and merged_count >= 0
      and reactivated_count >= 0
    )
);

drop trigger if exists trg_vocabulary_card_generation_attempts_set_updated_at
on public.vocabulary_card_generation_attempts;
create trigger trg_vocabulary_card_generation_attempts_set_updated_at
before update on public.vocabulary_card_generation_attempts
for each row
execute function public.set_updated_at();

create index if not exists idx_vocabulary_card_generation_attempts_user_date
  on public.vocabulary_card_generation_attempts (user_id, attempt_date);

create index if not exists idx_vocabulary_card_generation_attempts_status_date
  on public.vocabulary_card_generation_attempts (attempt_date, status);

alter table public.vocabulary_card_generation_attempts enable row level security;

revoke all on table public.vocabulary_card_generation_attempts
from anon, authenticated;

grant all on table public.vocabulary_card_generation_attempts
to service_role;

create or replace function public.claim_vocabulary_card_generation_attempt(
  p_user_id uuid,
  p_attempt_date date,
  p_daily_limit int,
  p_requested_count int,
  p_provider text default 'openrouter'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used_attempts int;
  v_attempt_id uuid;
begin
  if p_daily_limit < 1 then
    raise exception 'daily_limit must be positive';
  end if;

  if p_requested_count < 1 then
    raise exception 'requested_count must be positive';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-card:' || p_attempt_date::text)
  );

  select count(*)::int
  into v_used_attempts
  from public.vocabulary_card_generation_attempts
  where user_id = p_user_id
    and attempt_date = p_attempt_date;

  if v_used_attempts >= p_daily_limit then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_CARD_ATTEMPTS_EXHAUSTED',
      'message', 'Попытки подготовки карточек на сегодня закончились.',
      'usedAttempts', v_used_attempts,
      'remainingAttempts', 0
    );
  end if;

  insert into public.vocabulary_card_generation_attempts (
    user_id,
    attempt_date,
    status,
    provider,
    requested_count
  )
  values (
    p_user_id,
    p_attempt_date,
    'started',
    p_provider,
    p_requested_count
  )
  returning id into v_attempt_id;

  return jsonb_build_object(
    'ok', true,
    'attemptId', v_attempt_id,
    'usedAttempts', v_used_attempts + 1,
    'remainingAttempts', greatest(p_daily_limit - v_used_attempts - 1, 0)
  );
end;
$$;

revoke all on function public.claim_vocabulary_card_generation_attempt(
  uuid,
  date,
  int,
  int,
  text
)
from public, anon, authenticated;

grant execute on function public.claim_vocabulary_card_generation_attempt(
  uuid,
  date,
  int,
  int,
  text
)
to service_role;

select cron.schedule(
  'cleanup_vocabulary_card_generation_attempts',
  '25 3 * * *',
  $$
    delete from public.vocabulary_card_generation_attempts
    where created_at < now() - interval '90 days';
  $$
);
