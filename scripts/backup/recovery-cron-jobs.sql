\set ON_ERROR_STOP on

create extension if not exists pg_cron
with schema pg_catalog;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'cleanup_ai_generation_attempts',
  'cleanup_vocabulary_card_generation_attempts',
  'cleanup_support_reports'
);

select cron.schedule(
  'cleanup_ai_generation_attempts',
  '20 3 * * *',
  $job$
    delete from public.reading_generation_attempts
    where created_at < now() - interval '90 days';
  $job$
);

select cron.schedule(
  'cleanup_vocabulary_card_generation_attempts',
  '25 3 * * *',
  $job$
    delete from public.vocabulary_card_generation_attempts
    where created_at < now() - interval '90 days';
  $job$
);

select cron.schedule(
  'cleanup_support_reports',
  '35 3 * * *',
  $job$
    delete from public.support_reports
    where created_at < now() - interval '30 days';
  $job$
);

select cron.alter_job(jobid, active := false)
from cron.job
where jobname in (
  'cleanup_ai_generation_attempts',
  'cleanup_vocabulary_card_generation_attempts',
  'cleanup_support_reports'
);
