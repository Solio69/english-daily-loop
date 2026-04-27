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
  v_first_text_completed_at timestamptz;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('complete-reading:' || p_completed_date::text)
  );

  perform 1
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
    now()
  )
  on conflict (user_id, completed_date)
  do update set completed_at = excluded.completed_at;

  delete from public.user_active_reading_texts
  where user_id = p_user_id;

  update public.users
  set first_text_completed_at = coalesce(first_text_completed_at, now())
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
