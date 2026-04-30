alter table public.reading_generation_attempts
add column if not exists prompt_version text,
add column if not exists model_chain text[],
add column if not exists target_level text,
add column if not exists reading_minutes int,
add column if not exists target_word_min int,
add column if not exists target_word_max int,
add column if not exists validation_word_min int,
add column if not exists validation_word_max int,
add column if not exists max_tokens int,
add column if not exists output_word_count int,
add column if not exists fallback_used boolean,
add column if not exists duration_ms int,
add column if not exists failure_stage text;

alter table public.reading_generation_attempts
drop constraint if exists reading_generation_attempts_target_level_check,
add constraint reading_generation_attempts_target_level_check
  check (target_level is null or target_level in ('A1', 'A2', 'B1', 'B2'));

alter table public.reading_generation_attempts
drop constraint if exists reading_generation_attempts_reading_minutes_check,
add constraint reading_generation_attempts_reading_minutes_check
  check (reading_minutes is null or reading_minutes in (3, 5, 10, 15));

alter table public.reading_generation_attempts
drop constraint if exists reading_generation_attempts_word_config_check,
add constraint reading_generation_attempts_word_config_check
  check (
    (target_word_min is null or target_word_min > 0)
    and (target_word_max is null or target_word_max > 0)
    and (validation_word_min is null or validation_word_min > 0)
    and (validation_word_max is null or validation_word_max > 0)
    and (max_tokens is null or max_tokens > 0)
    and (output_word_count is null or output_word_count > 0)
    and (duration_ms is null or duration_ms >= 0)
  );

alter table public.reading_generation_attempts
drop constraint if exists reading_generation_attempts_word_range_check,
add constraint reading_generation_attempts_word_range_check
  check (
    (target_word_min is null or target_word_max is null or target_word_min <= target_word_max)
    and (validation_word_min is null or validation_word_max is null or validation_word_min <= validation_word_max)
  );

alter table public.reading_generation_attempts
drop constraint if exists reading_generation_attempts_failure_stage_check,
add constraint reading_generation_attempts_failure_stage_check
  check (
    failure_stage is null
    or failure_stage in (
      'provider_request',
      'provider_response',
      'output_validation',
      'db_save',
      'unknown'
    )
  );

create index if not exists idx_reading_generation_attempts_status_date
  on public.reading_generation_attempts (attempt_date, status);

create index if not exists idx_reading_generation_attempts_failure_stage
  on public.reading_generation_attempts (failure_stage)
  where failure_stage is not null;
