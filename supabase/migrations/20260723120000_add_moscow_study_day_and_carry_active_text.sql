create or replace function public.get_moscow_study_date(
  p_at timestamptz
)
returns date
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select ((p_at at time zone 'Europe/Moscow') - interval '5 hours')::date;
$$;

revoke all on function public.get_moscow_study_date(timestamptz)
from public, anon, authenticated;

grant execute on function public.get_moscow_study_date(timestamptz)
to service_role;

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
  v_completed_date date;
  v_first_text_completed_at timestamptz;
begin
  -- The database timestamp is authoritative for the mutation. The parameter
  -- stays in the signature only for a backward-compatible coordinated rollout.
  v_completed_date := public.get_moscow_study_date(v_completed_at);

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('complete-reading:' || v_completed_date::text)
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
    v_completed_date,
    v_completed_at
  )
  on conflict (user_id, completed_date)
  do nothing;

  insert into public.user_completed_reading_texts (
    user_id,
    reading_text_id,
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
    v_active_text.reading_text_id,
    v_completed_date,
    v_completed_at,
    v_active_text.title,
    v_active_text.body,
    v_active_text.level,
    v_active_text.estimated_minutes,
    v_active_text.provider,
    v_active_text.model,
    v_active_text.fallback_used
  )
  on conflict (user_id, reading_text_id)
  do update set
    completed_date = excluded.completed_date,
    completed_at = excluded.completed_at,
    title = excluded.title,
    body = excluded.body,
    level = excluded.level,
    estimated_minutes = excluded.estimated_minutes,
    provider = excluded.provider,
    model = excluded.model,
    fallback_used = excluded.fallback_used;

  delete from public.user_active_reading_texts
  where user_id = p_user_id
    and reading_text_id = v_active_text.reading_text_id;

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
    'completedDate', v_completed_date,
    'firstTextCompletedAt', v_first_text_completed_at
  );
end;
$$;

revoke all on function public.complete_daily_reading_text(uuid, date)
from public, anon, authenticated;

grant execute on function public.complete_daily_reading_text(uuid, date)
to service_role;

create or replace function public.save_pending_vocabulary_word_with_source(
  p_user_id uuid,
  p_word text,
  p_reading_text_id uuid,
  p_reading_date date,
  p_word_index int,
  p_original_word text,
  p_vocabulary_limit int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_text public.user_active_reading_texts%rowtype;
  v_word public.user_vocabulary_words%rowtype;
  v_total_words int;
  v_action text;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-word-save')
  );

  -- p_reading_date stays in the signature only for a backward-compatible
  -- coordinated rollout. Active-text ownership no longer depends on its
  -- generation date.

  select *
  into v_active_text
  from public.user_active_reading_texts
  where user_id = p_user_id
    and reading_text_id = p_reading_text_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'NO_ACTIVE_READING_TEXT',
      'message', 'Active reading text is not available.'
    );
  end if;

  select *
  into v_word
  from public.user_vocabulary_words
  where user_id = p_user_id
    and lower(word) = lower(btrim(p_word))
  for update;

  if v_word.id is not null then
    if v_word.status = 'learned' then
      update public.user_vocabulary_words
      set status = 'not_started',
          review_step = null,
          next_review_date = null,
          last_reviewed_at = null,
          review_count = 0,
          forgot_count = 0,
          same_step_count = 0,
          next_step_count = 0,
          jump_step_count = 0,
          learned_at = null
      where id = v_word.id
      returning * into v_word;

      v_action := 'reactivated';
    else
      v_action := 'already_exists';
    end if;
  else
    select count(*)
    into v_total_words
    from public.user_vocabulary_words
    where user_id = p_user_id;

    if v_total_words >= p_vocabulary_limit then
      return jsonb_build_object(
        'ok', false,
        'code', 'VOCABULARY_LIMIT_EXCEEDED',
        'message', 'Vocabulary words limit is exhausted.'
      );
    end if;

    insert into public.user_vocabulary_words (
      user_id,
      word,
      status,
      card_status
    )
    values (
      p_user_id,
      lower(btrim(p_word)),
      'not_started',
      'pending'
    )
    returning * into v_word;

    v_action := 'created';
  end if;

  insert into public.user_vocabulary_word_sources (
    user_id,
    word_id,
    reading_text_id,
    word_index,
    original_word
  )
  values (
    p_user_id,
    v_word.id,
    p_reading_text_id,
    p_word_index,
    btrim(p_original_word)
  )
  on conflict (user_id, reading_text_id, word_index)
  do update set
    word_id = excluded.word_id,
    original_word = excluded.original_word;

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'wordId', v_word.id,
    'word', v_word.word,
    'status', v_word.status,
    'cardStatus', v_word.card_status
  );
end;
$$;

revoke all on function public.save_pending_vocabulary_word_with_source(
  uuid,
  text,
  uuid,
  date,
  int,
  text,
  int
)
from public, anon, authenticated;

grant execute on function public.save_pending_vocabulary_word_with_source(
  uuid,
  text,
  uuid,
  date,
  int,
  text,
  int
)
to service_role;

create or replace function public.get_or_create_vocabulary_review_state(
  p_user_id uuid,
  p_review_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completion public.user_daily_vocabulary_review_completions%rowtype;
  v_current_card jsonb := null;
  v_total_ready_count int := 0;
  v_pending_count int := 0;
  v_needs_approval_count int := 0;
  v_remaining_required_count int := 0;
  v_new_available_count int := 0;
  v_actual_reviewed_today_count int := 0;
  v_reviewed_today_count int := 0;
  v_required_total_count int := 0;
  v_extra_available_count int := 0;
  v_display_reviewed_count int := 0;
  v_display_remaining_count int := 0;
  v_display_total_count int := 0;
  v_status text := 'not_started';
  v_is_optional boolean := false;
  v_now timestamptz := now();
  v_review_date date;
begin
  -- The database timestamp is authoritative for the snapshot and for the
  -- optional completion row this RPC can create.
  v_review_date := public.get_moscow_study_date(v_now);

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-review:' || v_review_date::text)
  );

  select *
  into v_completion
  from public.user_daily_vocabulary_review_completions
  where user_id = p_user_id
    and review_date = v_review_date;

  select
    count(*) filter (where card_status = 'ready'),
    count(*) filter (where card_status = 'pending'),
    count(*) filter (where card_status = 'needs_approval'),
    count(*) filter (
      where card_status = 'ready'
        and (
          status = 'not_started'
          or (
            status = 'active'
            and next_review_date is not null
            and next_review_date <= v_review_date
          )
        )
    ),
    count(*) filter (
      where card_status = 'ready'
        and status = 'not_started'
    ),
    count(*) filter (
      where card_status = 'ready'
        and last_reviewed_at is not null
        and public.get_moscow_study_date(last_reviewed_at) = v_review_date
    )
  into
    v_total_ready_count,
    v_pending_count,
    v_needs_approval_count,
    v_remaining_required_count,
    v_new_available_count,
    v_actual_reviewed_today_count
  from public.user_vocabulary_words
  where user_id = p_user_id;

  if v_completion.id is null and v_remaining_required_count = 0 then
    insert into public.user_daily_vocabulary_review_completions (
      user_id,
      review_date,
      completed_at,
      reviewed_count
    )
    values (
      p_user_id,
      v_review_date,
      v_now,
      v_actual_reviewed_today_count
    )
    on conflict (user_id, review_date)
    do update set
      completed_at = excluded.completed_at,
      reviewed_count = excluded.reviewed_count
    returning * into v_completion;
  end if;

  if v_completion.id is not null then
    v_status := 'completed';
    v_required_total_count := v_completion.reviewed_count;
    v_remaining_required_count := 0;
    v_reviewed_today_count := v_completion.reviewed_count;
    v_extra_available_count := v_new_available_count;
    v_is_optional := true;
    v_display_reviewed_count := greatest(
      v_actual_reviewed_today_count,
      v_completion.reviewed_count
    );
    v_display_remaining_count := v_new_available_count;
    v_display_total_count := v_display_reviewed_count + v_display_remaining_count;

    select to_jsonb(word_row)
    into v_current_card
    from public.user_vocabulary_words as word_row
    where word_row.user_id = p_user_id
      and word_row.card_status = 'ready'
      and word_row.status = 'not_started'
    order by word_row.updated_at, word_row.id
    limit 1;
  else
    v_status := case
      when v_actual_reviewed_today_count > 0 then 'in_progress'
      else 'not_started'
    end;
    v_reviewed_today_count := v_actual_reviewed_today_count;
    v_required_total_count := v_reviewed_today_count + v_remaining_required_count;
    v_display_reviewed_count := v_reviewed_today_count;
    v_display_remaining_count := v_remaining_required_count;
    v_display_total_count := v_required_total_count;

    select to_jsonb(word_row)
    into v_current_card
    from public.user_vocabulary_words as word_row
    where word_row.user_id = p_user_id
      and word_row.card_status = 'ready'
      and (
        word_row.status = 'not_started'
        or (
          word_row.status = 'active'
          and word_row.next_review_date is not null
          and word_row.next_review_date <= v_review_date
        )
      )
    order by
      case
        when word_row.status = 'not_started' then 0
        when word_row.next_review_date < v_review_date then 1
        else 2
      end,
      case
        when word_row.status = 'not_started' then word_row.updated_at
      end,
      word_row.next_review_date,
      word_row.id
    limit 1;
  end if;

  return jsonb_build_object(
    'reviewDate', v_review_date,
    'status', v_status,
    'totalReadyCount', v_total_ready_count,
    'requiredTotalCount', v_required_total_count,
    'reviewedTodayCount', v_reviewed_today_count,
    'remainingRequiredCount', v_remaining_required_count,
    'newAvailableCount', v_new_available_count,
    'extraAvailableCount', v_extra_available_count,
    'displayTotalCount', v_display_total_count,
    'displayReviewedCount', v_display_reviewed_count,
    'displayRemainingCount', v_display_remaining_count,
    'completedAt', v_completion.completed_at,
    'dictionaryActions', jsonb_build_object(
      'pendingCount', v_pending_count,
      'needsApprovalCount', v_needs_approval_count
    ),
    'currentCard', v_current_card,
    'currentCardIsOptional', v_is_optional and v_current_card is not null
  );
end;
$$;

revoke all on function public.get_or_create_vocabulary_review_state(uuid, date)
from public, anon, authenticated;

grant execute on function public.get_or_create_vocabulary_review_state(uuid, date)
to service_role;

create or replace function public.review_vocabulary_word(
  p_user_id uuid,
  p_word_id uuid,
  p_action text,
  p_review_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word public.user_vocabulary_words%rowtype;
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
  v_current_index int := 1;
  v_next_index int := 1;
  v_next_step text;
  v_next_review_date date;
  v_now timestamptz := now();
  v_completion_exists boolean;
  v_was_required boolean := false;
  v_remaining_required_count int := 0;
  v_reviewed_today_count int := 0;
  v_review_date date;
begin
  -- Use the same database timestamp for the stored review event and its study
  -- date so a request crossing 05:00 cannot be split between two study days.
  v_review_date := public.get_moscow_study_date(v_now);

  if p_action not in ('forgot', 'same_step', 'next_step', 'jump_step') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_REVIEW_ACTION',
      'message', 'Review action is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-review:' || v_review_date::text)
  );

  select *
  into v_word
  from public.user_vocabulary_words
  where id = p_word_id
    and user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_WORD_NOT_FOUND',
      'message', 'Vocabulary word was not found.'
    );
  end if;

  if v_word.card_status <> 'ready' then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_CARD_NOT_READY',
      'message', 'Vocabulary card is not ready for review.'
    );
  end if;

  if v_word.status = 'learned' then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_WORD_ALREADY_LEARNED',
      'message', 'Vocabulary word is already learned.'
    );
  end if;

  select exists (
    select 1
    from public.user_daily_vocabulary_review_completions
    where user_id = p_user_id
      and review_date = v_review_date
  )
  into v_completion_exists;

  v_was_required :=
    not v_completion_exists
    and (
      v_word.status = 'not_started'
      or (
        v_word.status = 'active'
        and v_word.next_review_date is not null
        and v_word.next_review_date <= v_review_date
      )
    );

  if v_word.status = 'active' and v_word.review_step is not null then
    v_current_index := array_position(v_steps, v_word.review_step);
    if v_current_index is null then
      v_current_index := 1;
    end if;
  end if;

  v_next_index := case p_action
    when 'forgot' then 1
    when 'same_step' then v_current_index
    when 'next_step' then v_current_index + 1
    when 'jump_step' then v_current_index + 2
  end;

  if v_next_index > array_length(v_steps, 1) then
    update public.user_vocabulary_words
    set status = 'learned',
        review_step = null,
        next_review_date = null,
        last_reviewed_at = v_now,
        review_count = review_count + 1,
        forgot_count = forgot_count + case when p_action = 'forgot' then 1 else 0 end,
        same_step_count = same_step_count + case when p_action = 'same_step' then 1 else 0 end,
        next_step_count = next_step_count + case when p_action = 'next_step' then 1 else 0 end,
        jump_step_count = jump_step_count + case when p_action = 'jump_step' then 1 else 0 end,
        learned_at = v_now
    where id = v_word.id
      and user_id = p_user_id
    returning * into v_word;
  else
    v_next_step := v_steps[v_next_index];
    v_next_review_date := (case v_next_step
      when '1_day' then v_review_date + interval '1 day'
      when '3_days' then v_review_date + interval '3 days'
      when '7_days' then v_review_date + interval '7 days'
      when '14_days' then v_review_date + interval '14 days'
      when '1_month' then v_review_date + interval '1 month'
      when '2_months' then v_review_date + interval '2 months'
      when '3_months' then v_review_date + interval '3 months'
      when '4_months' then v_review_date + interval '4 months'
      when '5_months' then v_review_date + interval '5 months'
      when '6_months' then v_review_date + interval '6 months'
    end)::date;

    update public.user_vocabulary_words
    set status = 'active',
        review_step = v_next_step,
        next_review_date = v_next_review_date,
        last_reviewed_at = v_now,
        review_count = review_count + 1,
        forgot_count = forgot_count + case when p_action = 'forgot' then 1 else 0 end,
        same_step_count = same_step_count + case when p_action = 'same_step' then 1 else 0 end,
        next_step_count = next_step_count + case when p_action = 'next_step' then 1 else 0 end,
        jump_step_count = jump_step_count + case when p_action = 'jump_step' then 1 else 0 end,
        learned_at = null
    where id = v_word.id
      and user_id = p_user_id
    returning * into v_word;
  end if;

  if v_was_required then
    select count(*)
    into v_remaining_required_count
    from public.user_vocabulary_words
    where user_id = p_user_id
      and card_status = 'ready'
      and (
        status = 'not_started'
        or (
          status = 'active'
          and next_review_date is not null
          and next_review_date <= v_review_date
        )
      );

    if v_remaining_required_count = 0 then
      select count(*)
      into v_reviewed_today_count
      from public.user_vocabulary_words
      where user_id = p_user_id
        and card_status = 'ready'
        and last_reviewed_at is not null
        and public.get_moscow_study_date(last_reviewed_at) = v_review_date;

      insert into public.user_daily_vocabulary_review_completions (
        user_id,
        review_date,
        completed_at,
        reviewed_count
      )
      values (
        p_user_id,
        v_review_date,
        v_now,
        v_reviewed_today_count
      )
      on conflict (user_id, review_date)
      do update set
        completed_at = excluded.completed_at,
        reviewed_count = excluded.reviewed_count;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'reviewDate', v_review_date,
    'wordId', v_word.id,
    'word', v_word.word,
    'status', v_word.status,
    'reviewStep', v_word.review_step,
    'nextReviewDate', v_word.next_review_date,
    'learnedAt', v_word.learned_at,
    'wasRequired', v_was_required
  );
end;
$$;

revoke all on function public.review_vocabulary_word(uuid, uuid, text, date)
from public, anon, authenticated;

grant execute on function public.review_vocabulary_word(uuid, uuid, text, date)
to service_role;

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
  v_review_date date;
begin
  -- Dev mutations follow the same database-authoritative clock as production
  -- review mutations. p_review_date remains for signature compatibility.
  v_review_date := public.get_moscow_study_date(v_now);

  if array_position(v_steps, p_review_step) is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_REVIEW_STEP',
      'message', 'Review step is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-review:' || v_review_date::text)
  );

  v_next_review_date := (case p_review_step
    when '1_day' then v_review_date + interval '1 day'
    when '3_days' then v_review_date + interval '3 days'
    when '7_days' then v_review_date + interval '7 days'
    when '14_days' then v_review_date + interval '14 days'
    when '1_month' then v_review_date + interval '1 month'
    when '2_months' then v_review_date + interval '2 months'
    when '3_months' then v_review_date + interval '3 months'
    when '4_months' then v_review_date + interval '4 months'
    when '5_months' then v_review_date + interval '5 months'
    when '6_months' then v_review_date + interval '6 months'
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
          and next_review_date <= v_review_date
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
    and public.get_moscow_study_date(last_reviewed_at) = v_review_date;

  insert into public.user_daily_vocabulary_review_completions (
    user_id,
    review_date,
    completed_at,
    reviewed_count
  )
  values (
    p_user_id,
    v_review_date,
    v_now,
    v_reviewed_today_count
  )
  on conflict (user_id, review_date)
  do update set
    completed_at = excluded.completed_at,
    reviewed_count = excluded.reviewed_count;

  return jsonb_build_object(
    'ok', true,
    'reviewDate', v_review_date,
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
