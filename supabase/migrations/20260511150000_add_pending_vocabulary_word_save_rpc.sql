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

    insert into public.user_vocabulary_words (
      user_id,
      word,
      status,
      card_status
    )
    values (
      p_user_id,
      lower(btrim(p_word)),
      'unlearned',
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
