alter table public.user_vocabulary_words
add column if not exists card_status text not null default 'ready';

update public.user_vocabulary_words
set card_status = 'ready'
where translation is not null
  and part_of_speech is not null
  and examples is not null;

alter table public.user_vocabulary_words
alter column translation drop not null,
alter column part_of_speech drop not null,
alter column is_verb drop not null,
alter column examples drop not null;

alter table public.user_vocabulary_words
drop constraint if exists user_vocabulary_words_translation_not_empty,
drop constraint if exists user_vocabulary_words_part_of_speech_not_empty,
drop constraint if exists user_vocabulary_words_verb_forms_check;

alter table public.user_vocabulary_words
add constraint user_vocabulary_words_card_status_check
  check (card_status in ('pending', 'ready')),
add constraint user_vocabulary_words_ready_card_check
  check (
    card_status = 'pending'
    or (
      translation is not null
      and length(btrim(translation)) > 0
      and part_of_speech is not null
      and length(btrim(part_of_speech)) > 0
      and is_verb is not null
      and examples is not null
      and (
        (is_verb = true and verb_forms is not null)
        or (is_verb = false and verb_forms is null)
      )
    )
  );

create index if not exists idx_user_vocabulary_words_user_card_status_created
  on public.user_vocabulary_words (user_id, card_status, created_at);

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
  v_card_status text;
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

    v_card_status := case
      when p_translation is not null
        and p_part_of_speech is not null
        and p_is_verb is not null
        and p_examples is not null
      then 'ready'
      else 'pending'
    end;

    insert into public.user_vocabulary_words (
      user_id,
      word,
      translation,
      part_of_speech,
      is_verb,
      is_regular_verb,
      verb_forms,
      examples,
      status,
      card_status
    )
    values (
      p_user_id,
      lower(btrim(p_word)),
      case when p_translation is null then null else btrim(p_translation) end,
      case when p_part_of_speech is null then null else lower(btrim(p_part_of_speech)) end,
      p_is_verb,
      p_is_regular_verb,
      p_verb_forms,
      p_examples,
      'unlearned',
      v_card_status
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
