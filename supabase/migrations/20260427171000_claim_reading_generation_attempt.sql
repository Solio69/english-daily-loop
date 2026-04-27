create or replace function public.claim_reading_generation_attempt(
  p_user_id uuid,
  p_attempt_date date,
  p_daily_limit int,
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

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(p_attempt_date::text)
  );

  select count(*)::int
  into v_used_attempts
  from public.reading_generation_attempts
  where user_id = p_user_id
    and attempt_date = p_attempt_date;

  if v_used_attempts >= p_daily_limit then
    return jsonb_build_object(
      'ok', false,
      'code', 'GENERATION_ATTEMPTS_EXHAUSTED',
      'message', 'Попытки генерации текста на сегодня закончились.',
      'usedAttempts', v_used_attempts,
      'remainingAttempts', 0
    );
  end if;

  insert into public.reading_generation_attempts (
    user_id,
    attempt_date,
    status,
    provider
  )
  values (
    p_user_id,
    p_attempt_date,
    'started',
    p_provider
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

revoke all on function public.claim_reading_generation_attempt(uuid, date, int, text)
from public, anon, authenticated;

grant execute on function public.claim_reading_generation_attempt(uuid, date, int, text)
to service_role;
