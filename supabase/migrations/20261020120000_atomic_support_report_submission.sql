create or replace function public.submit_support_report(
  p_user_id uuid,
  p_app_role text,
  p_current_screen text,
  p_user_comment text,
  p_app_context jsonb,
  p_events jsonb,
  p_request_ids text[],
  p_ai_diagnostics jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_report_count integer;
  v_report_id uuid;
begin
  -- Serialize submissions for this user before counting the rolling window.
  perform 1
  from public.users
  where id = p_user_id
  for update;

  if not found then
    raise exception 'SUPPORT_USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_now := clock_timestamp();

  select count(*)
  into v_report_count
  from public.support_reports
  where user_id = p_user_id
    and created_at > v_now - interval '1 hour'
    and created_at <= v_now;

  if v_report_count >= 5 then
    raise exception 'SUPPORT_REPORT_RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.support_reports (
    user_id,
    app_role,
    current_screen,
    user_comment,
    app_context,
    events,
    request_ids,
    ai_diagnostics,
    report_date,
    created_at
  )
  values (
    p_user_id,
    p_app_role,
    p_current_screen,
    p_user_comment,
    p_app_context,
    p_events,
    p_request_ids,
    p_ai_diagnostics,
    (v_now at time zone 'Europe/Moscow')::date,
    v_now
  )
  returning id into v_report_id;

  return jsonb_build_object('reportId', v_report_id, 'createdAt', v_now);
end;
$$;

revoke all on function public.submit_support_report(
  uuid, text, text, text, jsonb, jsonb, text[], jsonb
) from public, anon, authenticated;

grant execute on function public.submit_support_report(
  uuid, text, text, text, jsonb, jsonb, text[], jsonb
) to service_role;
