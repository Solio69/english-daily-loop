alter table public.user_vocabulary_words
drop constraint if exists user_vocabulary_words_card_status_check,
drop constraint if exists user_vocabulary_words_ready_card_check;

alter table public.user_vocabulary_words
add constraint user_vocabulary_words_card_status_check
  check (card_status in ('pending', 'needs_approval', 'ready')),
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

create index if not exists idx_user_vocabulary_words_user_card_status_updated
  on public.user_vocabulary_words (user_id, card_status, updated_at desc, id desc);
