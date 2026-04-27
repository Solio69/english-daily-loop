create or replace function public.complete_daily_reading_text(
  p_user_id uuid,
  p_completed_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_text public.user_active_reading_texts%rowtype;
  v_completed_at timestamptz := now();
  v_first_text_completed_at timestamptz;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('complete-reading:' || p_completed_date::text)
  );

  select *
  into v_active_text
  from public.user_active_reading_texts
  where user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'NO_ACTIVE_READING_TEXT',
      'message', 'There is no active reading text.'
    );
  end if;

  insert into public.user_daily_reading_completions (
    user_id,
    completed_date,
    completed_at
  )
  values (
    p_user_id,
    p_completed_date,
    v_completed_at
  )
  on conflict (user_id, completed_date)
  do update set completed_at = excluded.completed_at;

  insert into public.user_completed_reading_texts (
    user_id,
    completed_date,
    completed_at,
    title,
    body,
    level,
    estimated_minutes,
    provider,
    model,
    fallback_used
  )
  values (
    p_user_id,
    p_completed_date,
    v_completed_at,
    v_active_text.title,
    v_active_text.body,
    v_active_text.level,
    v_active_text.estimated_minutes,
    v_active_text.provider,
    v_active_text.model,
    v_active_text.fallback_used
  )
  on conflict (user_id, completed_date)
  do update set
    completed_at = excluded.completed_at,
    title = excluded.title,
    body = excluded.body,
    level = excluded.level,
    estimated_minutes = excluded.estimated_minutes,
    provider = excluded.provider,
    model = excluded.model,
    fallback_used = excluded.fallback_used;

  delete from public.user_active_reading_texts
  where user_id = p_user_id;

  update public.users
  set first_text_completed_at = coalesce(first_text_completed_at, v_completed_at)
  where id = p_user_id
  returning first_text_completed_at into v_first_text_completed_at;

  if v_first_text_completed_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'USER_NOT_FOUND',
      'message', 'User profile was not found.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'completedDate', p_completed_date,
    'firstTextCompletedAt', v_first_text_completed_at
  );
end;
$$;

revoke all on function public.complete_daily_reading_text(uuid, date)
from public, anon, authenticated;

grant execute on function public.complete_daily_reading_text(uuid, date)
to service_role;
