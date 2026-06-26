create or replace function public.dev_complete_vocabulary_reviews_at_step(
  p_user_id uuid,
  p_review_date date,
  p_review_step text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_steps text[] := array[
    '1_day',
    '3_days',
    '7_days',
    '14_days',
    '1_month',
    '2_months',
    '3_months',
    '4_months',
    '5_months',
    '6_months'
  ];
  v_next_review_date date;
  v_now timestamptz := now();
  v_processed_count int := 0;
  v_reviewed_today_count int := 0;
begin
  if array_position(v_steps, p_review_step) is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_REVIEW_STEP',
      'message', 'Review step is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-review:' || p_review_date::text)
  );

  v_next_review_date := (case p_review_step
    when '1_day' then p_review_date + interval '1 day'
    when '3_days' then p_review_date + interval '3 days'
    when '7_days' then p_review_date + interval '7 days'
    when '14_days' then p_review_date + interval '14 days'
    when '1_month' then p_review_date + interval '1 month'
    when '2_months' then p_review_date + interval '2 months'
    when '3_months' then p_review_date + interval '3 months'
    when '4_months' then p_review_date + interval '4 months'
    when '5_months' then p_review_date + interval '5 months'
    when '6_months' then p_review_date + interval '6 months'
  end)::date;

  with updated_words as (
    update public.user_vocabulary_words
    set status = 'active',
        review_step = p_review_step,
        next_review_date = v_next_review_date,
        last_reviewed_at = v_now,
        review_count = review_count + 1,
        learned_at = null
    where user_id = p_user_id
      and card_status = 'ready'
      and (
        status = 'not_started'
        or (
          status = 'active'
          and next_review_date is not null
          and next_review_date <= p_review_date
        )
      )
    returning id
  )
  select count(*)
  into v_processed_count
  from updated_words;

  select count(*)
  into v_reviewed_today_count
  from public.user_vocabulary_words
  where user_id = p_user_id
    and card_status = 'ready'
    and last_reviewed_at is not null
    and (last_reviewed_at at time zone 'Europe/Moscow')::date = p_review_date;

  insert into public.user_daily_vocabulary_review_completions (
    user_id,
    review_date,
    completed_at,
    reviewed_count
  )
  values (
    p_user_id,
    p_review_date,
    v_now,
    v_reviewed_today_count
  )
  on conflict (user_id, review_date)
  do update set
    completed_at = excluded.completed_at,
    reviewed_count = excluded.reviewed_count;

  return jsonb_build_object(
    'ok', true,
    'reviewDate', p_review_date,
    'reviewStep', p_review_step,
    'nextReviewDate', v_next_review_date,
    'processedCount', v_processed_count,
    'reviewedTodayCount', v_reviewed_today_count
  );
end;
$$;

revoke all on function public.dev_complete_vocabulary_reviews_at_step(
  uuid,
  date,
  text
)
from public, anon, authenticated;

grant execute on function public.dev_complete_vocabulary_reviews_at_step(
  uuid,
  date,
  text
)
to service_role;
