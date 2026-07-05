update public.user_vocabulary_words
set
  card_status = 'ready',
  status = 'not_started',
  review_step = null,
  next_review_date = null,
  last_reviewed_at = null,
  review_count = 0,
  forgot_count = 0,
  same_step_count = 0,
  next_step_count = 0,
  jump_step_count = 0,
  learned_at = null
where card_status = 'needs_approval';
