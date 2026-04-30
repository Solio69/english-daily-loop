create extension if not exists pg_cron
with schema pg_catalog;

select cron.schedule(
  'cleanup_ai_generation_attempts',
  '20 3 * * *',
  $$
    delete from public.reading_generation_attempts
    where created_at < now() - interval '90 days';
  $$
);
