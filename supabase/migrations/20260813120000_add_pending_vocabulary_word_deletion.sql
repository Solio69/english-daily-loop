create or replace function public.delete_pending_vocabulary_word_with_sources(
  p_user_id uuid,
  p_reading_text_id uuid,
  p_word_index int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word_id uuid;
  v_card_status text;
  v_removed_word_indexes int[];
  v_removed_source_count int;
begin
  if p_user_id is null
    or p_reading_text_id is null
    or p_word_index is null
    or p_word_index < 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_DELETE_INPUT',
      'message', 'Delete input is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-word-save')
  );

  perform 1
  from public.user_active_reading_texts
  where user_id = p_user_id
    and reading_text_id = p_reading_text_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'ACTIVE_TEXT_CHANGED',
      'message', 'Active reading text changed.'
    );
  end if;

  select source.word_id, vocabulary_word.card_status
  into v_word_id, v_card_status
  from public.user_vocabulary_word_sources as source
  join public.user_vocabulary_words as vocabulary_word
    on vocabulary_word.id = source.word_id
   and vocabulary_word.user_id = source.user_id
  where source.user_id = p_user_id
    and source.reading_text_id = p_reading_text_id
    and source.word_index = p_word_index
  for update of source, vocabulary_word;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_SOURCE_NOT_FOUND',
      'message', 'Vocabulary word source was not found.'
    );
  end if;

  if v_card_status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_CARD_ALREADY_PREPARED',
      'message', 'Vocabulary card is already prepared.'
    );
  end if;

  select coalesce(array_agg(word_index order by word_index), array[]::int[])
  into v_removed_word_indexes
  from public.user_vocabulary_word_sources
  where user_id = p_user_id
    and word_id = v_word_id
    and reading_text_id = p_reading_text_id;

  select count(*)
  into v_removed_source_count
  from public.user_vocabulary_word_sources
  where user_id = p_user_id
    and word_id = v_word_id;

  delete from public.user_vocabulary_words
  where id = v_word_id
    and user_id = p_user_id
    and card_status = 'pending';

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'VOCABULARY_CARD_ALREADY_PREPARED',
      'message', 'Vocabulary card is already prepared.'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'removedWordIndexes', to_jsonb(v_removed_word_indexes),
    'removedSourceCount', v_removed_source_count
  );
end;
$$;

revoke all on function public.delete_pending_vocabulary_word_with_sources(
  uuid,
  uuid,
  int
)
from public, anon, authenticated;

grant execute on function public.delete_pending_vocabulary_word_with_sources(
  uuid,
  uuid,
  int
)
to service_role;
