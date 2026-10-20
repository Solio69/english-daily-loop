alter table public.reading_generation_attempts
  add column if not exists request_id text,
  add column if not exists reading_text_id uuid;

create unique index if not exists idx_reading_generation_attempts_user_request
  on public.reading_generation_attempts (user_id, request_id)
  where request_id is not null;

create or replace function public.claim_reading_generation_request(
  p_user_id uuid,
  p_attempt_date date,
  p_daily_limit int,
  p_request_id text,
  p_provider text default 'openrouter'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used_attempts int;
  v_attempt public.reading_generation_attempts%rowtype;
begin
  if p_daily_limit < 1 then
    raise exception 'daily_limit must be positive';
  end if;
  if p_request_id is null or p_request_id !~ '^[a-zA-Z0-9_-]{8,80}$' then
    raise exception 'request_id is invalid';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('reading-generation-request')
  );
  -- Coordinate with the previous claim RPC while Edge deployments overlap.
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext(p_attempt_date::text)
  );

  select count(*)::int into v_used_attempts
  from public.reading_generation_attempts
  where user_id = p_user_id and attempt_date = p_attempt_date;

  select * into v_attempt
  from public.reading_generation_attempts
  where user_id = p_user_id
    and request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'isDuplicate', true,
      'attemptId', v_attempt.id,
      'usedAttempts', v_used_attempts,
      'remainingAttempts', greatest(p_daily_limit - v_used_attempts, 0)
    );
  end if;

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
    user_id, attempt_date, request_id, status, provider
  ) values (
    p_user_id, p_attempt_date, p_request_id, 'started', p_provider
  ) returning * into v_attempt;

  return jsonb_build_object(
    'ok', true,
    'isDuplicate', false,
    'attemptId', v_attempt.id,
    'usedAttempts', v_used_attempts + 1,
    'remainingAttempts', greatest(p_daily_limit - v_used_attempts - 1, 0)
  );
end;
$$;

revoke all on function public.claim_reading_generation_request(uuid, date, int, text, text)
from public, anon, authenticated;
grant execute on function public.claim_reading_generation_request(uuid, date, int, text, text)
to service_role;

create or replace function public.finish_reading_generation_request(
  p_user_id uuid,
  p_attempt_id uuid,
  p_reading_text_id uuid,
  p_title text,
  p_body text,
  p_level text,
  p_estimated_minutes int,
  p_provider text,
  p_model text,
  p_fallback_used boolean,
  p_reading_date date,
  p_output_word_count int,
  p_duration_ms int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_reading_text_id uuid;
begin
  select status, reading_text_id into v_status, v_reading_text_id
  from public.reading_generation_attempts
  where id = p_attempt_id and user_id = p_user_id
  for update;

  if v_status = 'succeeded' and v_reading_text_id = p_reading_text_id then
    return;
  end if;

  if not found or v_status <> 'started' then
    raise exception 'Generation attempt is not active';
  end if;

  insert into public.user_active_reading_texts (
    user_id, reading_text_id, title, body, level, estimated_minutes,
    provider, model, fallback_used, reading_date,
    last_read_paragraph_index, generated_at
  ) values (
    p_user_id, p_reading_text_id, p_title, p_body, p_level,
    p_estimated_minutes, p_provider, p_model, p_fallback_used,
    p_reading_date, null, now()
  )
  on conflict (user_id) do update set
    reading_text_id = excluded.reading_text_id,
    title = excluded.title,
    body = excluded.body,
    level = excluded.level,
    estimated_minutes = excluded.estimated_minutes,
    provider = excluded.provider,
    model = excluded.model,
    fallback_used = excluded.fallback_used,
    reading_date = excluded.reading_date,
    last_read_paragraph_index = null,
    generated_at = excluded.generated_at;

  update public.reading_generation_attempts set
    status = 'succeeded',
    reading_text_id = p_reading_text_id,
    provider = p_provider,
    model = p_model,
    fallback_used = p_fallback_used,
    output_word_count = p_output_word_count,
    duration_ms = p_duration_ms,
    failure_stage = null,
    error_code = null,
    error_message = null
  where id = p_attempt_id;
end;
$$;

revoke all on function public.finish_reading_generation_request(
  uuid, uuid, uuid, text, text, text, int, text, text, boolean, date, int, int
) from public, anon, authenticated;
grant execute on function public.finish_reading_generation_request(
  uuid, uuid, uuid, text, text, text, int, text, text, boolean, date, int, int
) to service_role;
