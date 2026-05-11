alter table public.user_active_reading_texts
add column if not exists reading_text_id uuid not null default gen_random_uuid();

alter table public.user_active_reading_texts
alter column reading_text_id drop default;

create unique index if not exists idx_user_active_reading_texts_reading_text_id
  on public.user_active_reading_texts (reading_text_id);

alter table public.user_completed_reading_texts
add column if not exists reading_text_id uuid not null default gen_random_uuid();

alter table public.user_completed_reading_texts
alter column reading_text_id drop default;

create unique index if not exists idx_user_completed_reading_texts_user_reading_text
  on public.user_completed_reading_texts (user_id, reading_text_id);

create table if not exists public.user_vocabulary_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  word text not null,
  translation text not null,
  part_of_speech text not null,
  is_verb boolean not null default false,
  is_regular_verb boolean,
  verb_forms jsonb,
  examples jsonb not null,
  status text not null default 'unlearned',
  learned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_vocabulary_words_word_not_empty
    check (length(btrim(word)) > 0),
  constraint user_vocabulary_words_translation_not_empty
    check (length(btrim(translation)) > 0),
  constraint user_vocabulary_words_part_of_speech_not_empty
    check (length(btrim(part_of_speech)) > 0),
  constraint user_vocabulary_words_status_check
    check (status in ('unlearned', 'learned')),
  constraint user_vocabulary_words_verb_forms_check
    check (
      (is_verb = true and verb_forms is not null)
      or (is_verb = false and verb_forms is null)
    )
);

create unique index if not exists idx_user_vocabulary_words_user_word
  on public.user_vocabulary_words (user_id, lower(word));

create index if not exists idx_user_vocabulary_words_user_status_created
  on public.user_vocabulary_words (user_id, status, created_at);

drop trigger if exists trg_user_vocabulary_words_set_updated_at on public.user_vocabulary_words;
create trigger trg_user_vocabulary_words_set_updated_at
before update on public.user_vocabulary_words
for each row
execute function public.set_updated_at();

alter table public.user_vocabulary_words enable row level security;

create table if not exists public.user_vocabulary_word_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  word_id uuid not null references public.user_vocabulary_words(id) on delete cascade,
  reading_text_id uuid not null,
  word_index int not null,
  original_word text not null,
  created_at timestamptz not null default now(),
  constraint user_vocabulary_word_sources_word_index_check
    check (word_index >= 0),
  constraint user_vocabulary_word_sources_original_word_not_empty
    check (length(btrim(original_word)) > 0)
);

create unique index if not exists idx_user_vocabulary_word_sources_unique_position
  on public.user_vocabulary_word_sources (user_id, reading_text_id, word_index);

create index if not exists idx_user_vocabulary_word_sources_user_reading_text
  on public.user_vocabulary_word_sources (user_id, reading_text_id);

alter table public.user_vocabulary_word_sources enable row level security;

revoke all on table public.user_vocabulary_words
from anon, authenticated;

revoke all on table public.user_vocabulary_word_sources
from anon, authenticated;

grant all on table public.user_vocabulary_words to service_role;
grant all on table public.user_vocabulary_word_sources to service_role;

create or replace function public.save_vocabulary_word_with_source(
  p_user_id uuid,
  p_word text,
  p_translation text,
  p_part_of_speech text,
  p_is_verb boolean,
  p_is_regular_verb boolean,
  p_verb_forms jsonb,
  p_examples jsonb,
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
      set status = 'unlearned',
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

    if p_translation is null
      or p_part_of_speech is null
      or p_is_verb is null
      or p_examples is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'VOCABULARY_CARD_REQUIRED',
        'message', 'Vocabulary card is required for a new word.'
      );
    end if;

    insert into public.user_vocabulary_words (
      user_id,
      word,
      translation,
      part_of_speech,
      is_verb,
      is_regular_verb,
      verb_forms,
      examples,
      status
    )
    values (
      p_user_id,
      lower(btrim(p_word)),
      btrim(p_translation),
      lower(btrim(p_part_of_speech)),
      p_is_verb,
      p_is_regular_verb,
      p_verb_forms,
      p_examples,
      'unlearned'
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
    'status', v_word.status
  );
end;
$$;

revoke all on function public.save_vocabulary_word_with_source(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  jsonb,
  uuid,
  int,
  text,
  int
)
from public, anon, authenticated;

grant execute on function public.save_vocabulary_word_with_source(
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  jsonb,
  uuid,
  int,
  text,
  int
)
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
  on conflict (user_id, completed_date)
  do update set
    reading_text_id = excluded.reading_text_id,
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
