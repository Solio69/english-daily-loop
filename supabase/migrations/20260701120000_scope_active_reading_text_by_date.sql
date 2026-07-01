alter table public.user_active_reading_texts
add column if not exists reading_date date;

update public.user_active_reading_texts
set reading_date = (generated_at at time zone 'Europe/Moscow')::date
where reading_date is null;

alter table public.user_active_reading_texts
alter column reading_date set not null;

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
    and reading_date = p_completed_date
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'NO_ACTIVE_READING_TEXT',
      'message', 'There is no active reading text for this date.'
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
    and reading_date = p_completed_date;

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

drop function if exists public.save_pending_vocabulary_word_with_source(
  uuid,
  text,
  uuid,
  int,
  text,
  int
);

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

  select *
  into v_active_text
  from public.user_active_reading_texts
  where user_id = p_user_id
    and reading_text_id = p_reading_text_id
    and reading_date = p_reading_date
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'NO_ACTIVE_READING_TEXT',
      'message', 'Active reading text is not available for this date.'
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
