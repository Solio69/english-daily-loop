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
  v_reviewed_today_count int := 0;
  v_required_total_count int := 0;
  v_extra_available_count int := 0;
  v_status text := 'not_started';
  v_is_optional boolean := false;
  v_now timestamptz := now();
begin
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-review:' || p_review_date::text)
  );

  select *
  into v_completion
  from public.user_daily_vocabulary_review_completions
  where user_id = p_user_id
    and review_date = p_review_date;

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
            and next_review_date <= p_review_date
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
        and (last_reviewed_at at time zone 'Europe/Moscow')::date = p_review_date
    )
  into
    v_total_ready_count,
    v_pending_count,
    v_needs_approval_count,
    v_remaining_required_count,
    v_new_available_count,
    v_reviewed_today_count
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
      p_review_date,
      v_now,
      v_reviewed_today_count
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
      when v_reviewed_today_count > 0 then 'in_progress'
      else 'not_started'
    end;
    v_required_total_count := v_reviewed_today_count + v_remaining_required_count;

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
          and word_row.next_review_date <= p_review_date
        )
      )
    order by
      case
        when word_row.status = 'not_started' then 0
        when word_row.next_review_date < p_review_date then 1
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
    'reviewDate', p_review_date,
    'status', v_status,
    'totalReadyCount', v_total_ready_count,
    'requiredTotalCount', v_required_total_count,
    'reviewedTodayCount', v_reviewed_today_count,
    'remainingRequiredCount', v_remaining_required_count,
    'newAvailableCount', v_new_available_count,
    'extraAvailableCount', v_extra_available_count,
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

create or replace function public.save_pending_vocabulary_word_with_source(
  p_user_id uuid,
  p_word text,
  p_reading_text_id uuid,
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
  v_word public.user_vocabulary_words%rowtype;
  v_total_words int;
  v_action text;
begin
  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-word-save')
  );

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
  int,
  text,
  int
)
from public, anon, authenticated;

grant execute on function public.save_pending_vocabulary_word_with_source(
  uuid,
  text,
  uuid,
  int,
  text,
  int
)
to service_role;
