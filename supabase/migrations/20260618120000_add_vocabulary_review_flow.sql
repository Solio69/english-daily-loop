alter table public.user_vocabulary_words
drop constraint if exists user_vocabulary_words_status_check;

update public.user_vocabulary_words
set status = 'not_started'
where status = 'unlearned';

alter table public.user_vocabulary_words
alter column status set default 'not_started';

alter table public.user_vocabulary_words
add column if not exists review_step text,
add column if not exists next_review_date date,
add column if not exists last_reviewed_at timestamptz,
add column if not exists review_count int not null default 0,
add column if not exists forgot_count int not null default 0,
add column if not exists same_step_count int not null default 0,
add column if not exists next_step_count int not null default 0,
add column if not exists jump_step_count int not null default 0;

alter table public.user_vocabulary_words
add constraint user_vocabulary_words_status_check
  check (status in ('not_started', 'active', 'learned')),
add constraint user_vocabulary_words_review_step_check
  check (
    review_step is null
    or review_step in (
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
    )
  ),
add constraint user_vocabulary_words_review_counts_check
  check (
    review_count >= 0
    and forgot_count >= 0
    and same_step_count >= 0
    and next_step_count >= 0
    and jump_step_count >= 0
  );

create index if not exists idx_user_vocabulary_words_review_queue
  on public.user_vocabulary_words (
    user_id,
    card_status,
    status,
    next_review_date,
    updated_at,
    id
  );

create table if not exists public.user_daily_vocabulary_review_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  review_date date not null,
  completed_at timestamptz not null default now(),
  reviewed_count int not null default 0,
  created_at timestamptz not null default now(),
  constraint user_daily_vocabulary_review_completions_count_check
    check (reviewed_count >= 0),
  constraint user_daily_vocabulary_review_completions_unique
    unique (user_id, review_date)
);

create index if not exists idx_user_daily_vocabulary_review_completions_user_date
  on public.user_daily_vocabulary_review_completions (user_id, review_date desc);

alter table public.user_daily_vocabulary_review_completions
enable row level security;

revoke all on table public.user_daily_vocabulary_review_completions
from anon, authenticated;

grant all on table public.user_daily_vocabulary_review_completions to service_role;

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

  select count(*)
  into v_total_words
  from public.user_vocabulary_words
  where user_id = p_user_id;

  if v_word.id is not null then
    if v_word.status = 'learned' then
      if v_total_words >= p_vocabulary_limit then
        return jsonb_build_object(
          'ok', false,
          'code', 'VOCABULARY_LIMIT_EXCEEDED',
          'message', 'Vocabulary words limit is exhausted.'
        );
      end if;

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
begin
  if p_action not in ('forgot', 'same_step', 'next_step', 'jump_step') then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_REVIEW_ACTION',
      'message', 'Review action is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-review:' || p_review_date::text)
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
      and review_date = p_review_date
  )
  into v_completion_exists;

  v_was_required :=
    not v_completion_exists
    and (
      v_word.status = 'not_started'
      or (
        v_word.status = 'active'
        and v_word.next_review_date is not null
        and v_word.next_review_date <= p_review_date
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
          and next_review_date <= p_review_date
        )
      );

    if v_remaining_required_count = 0 then
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
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
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
