create or replace function public.persist_generated_vocabulary_card(
  p_user_id uuid,
  p_pending_word_id uuid,
  p_word text,
  p_translation text,
  p_part_of_speech text,
  p_is_verb boolean,
  p_is_regular_verb boolean,
  p_verb_forms jsonb,
  p_examples jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending_word public.user_vocabulary_words%rowtype;
  v_existing_word public.user_vocabulary_words%rowtype;
  v_reactivated boolean := false;
begin
  if p_user_id is null
    or p_pending_word_id is null
    or p_word is null
    or length(btrim(p_word)) = 0
    or p_translation is null
    or length(btrim(p_translation)) = 0
    or p_part_of_speech is null
    or length(btrim(p_part_of_speech)) = 0
    or p_is_verb is null
    or p_examples is null
    or jsonb_typeof(p_examples) is distinct from 'array'
    or (
      p_is_verb = true
      and (
        p_is_regular_verb is null
        or p_verb_forms is null
        or jsonb_typeof(p_verb_forms) <> 'object'
      )
    )
    or (
      p_is_verb = false
      and (p_is_regular_verb is not null or p_verb_forms is not null)
    ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_VOCABULARY_CARD_INPUT',
      'message', 'Vocabulary card input is invalid.'
    );
  end if;

  if jsonb_array_length(p_examples) <> 3 then
    return jsonb_build_object(
      'ok', false,
      'code', 'INVALID_VOCABULARY_CARD_INPUT',
      'message', 'Vocabulary card input is invalid.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtext(p_user_id::text),
    hashtext('vocabulary-word-save')
  );

  select *
  into v_pending_word
  from public.user_vocabulary_words
  where id = p_pending_word_id
    and user_id = p_user_id
  for update;

  if not found or v_pending_word.card_status <> 'pending' then
    return jsonb_build_object(
      'ok', true,
      'prepared', false,
      'cancelled', true,
      'merged', false,
      'reactivated', false
    );
  end if;

  select *
  into v_existing_word
  from public.user_vocabulary_words
  where user_id = p_user_id
    and id <> p_pending_word_id
    and lower(word) = lower(btrim(p_word))
  for update;

  if not found then
    update public.user_vocabulary_words
    set word = lower(btrim(p_word)),
        translation = btrim(p_translation),
        part_of_speech = lower(btrim(p_part_of_speech)),
        is_verb = p_is_verb,
        is_regular_verb = p_is_regular_verb,
        verb_forms = p_verb_forms,
        examples = p_examples,
        status = 'not_started',
        card_status = 'ready',
        review_step = null,
        next_review_date = null,
        last_reviewed_at = null,
        review_count = 0,
        forgot_count = 0,
        same_step_count = 0,
        next_step_count = 0,
        jump_step_count = 0,
        learned_at = null
    where id = v_pending_word.id
      and user_id = p_user_id
      and card_status = 'pending';

    return jsonb_build_object(
      'ok', true,
      'prepared', true,
      'cancelled', false,
      'merged', false,
      'reactivated', false
    );
  end if;

  v_reactivated := v_existing_word.status = 'learned';

  if v_existing_word.card_status = 'pending' then
    update public.user_vocabulary_words
    set translation = btrim(p_translation),
        part_of_speech = lower(btrim(p_part_of_speech)),
        is_verb = p_is_verb,
        is_regular_verb = p_is_regular_verb,
        verb_forms = p_verb_forms,
        examples = p_examples,
        status = 'not_started',
        card_status = 'ready',
        review_step = null,
        next_review_date = null,
        last_reviewed_at = null,
        review_count = 0,
        forgot_count = 0,
        same_step_count = 0,
        next_step_count = 0,
        jump_step_count = 0,
        learned_at = null
    where id = v_existing_word.id
      and user_id = p_user_id;
  elsif v_reactivated then
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
    where id = v_existing_word.id
      and user_id = p_user_id;
  end if;

  update public.user_vocabulary_word_sources
  set word_id = v_existing_word.id
  where user_id = p_user_id
    and word_id = v_pending_word.id;

  delete from public.user_vocabulary_words
  where id = v_pending_word.id
    and user_id = p_user_id
    and card_status = 'pending';

  return jsonb_build_object(
    'ok', true,
    'prepared', true,
    'cancelled', false,
    'merged', true,
    'reactivated', v_reactivated
  );
end;
$$;

revoke all on function public.persist_generated_vocabulary_card(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  jsonb
)
from public, anon, authenticated;

grant execute on function public.persist_generated_vocabulary_card(
  uuid,
  uuid,
  text,
  text,
  text,
  boolean,
  boolean,
  jsonb,
  jsonb
)
to service_role;
