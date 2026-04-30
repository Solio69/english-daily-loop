# AI observability diagnostics

## 1) Назначение
Документ фиксирует текущую политику хранения AI attempt metadata и SQL-запросы
для диагностики генерации текстов.

AI observability нужна для ответов на вопросы:
- какая часть пайплайна чаще ломается
- какая модель чаще возвращает ошибки
- насколько часто используется fallback
- сколько времени занимает генерация
- не стала ли output validation слишком строгой

## 2) Где хранятся данные
Metadata AI-попыток хранится в `public.reading_generation_attempts`.

Таблица закрыта для прямого доступа `anon` и `authenticated`.
Запись и обновление выполняются только сервером через Edge Function `generate-reading-text`
и `SUPABASE_SERVICE_ROLE_KEY`.

## 3) Retention policy
Текущая политика хранения для `public.reading_generation_attempts`:
- operational diagnostics window: `90` дней
- старые attempt metadata удаляются после истечения retention window
- пользовательские материалы в `user_active_reading_texts` и `user_completed_reading_texts` не удаляются этой политикой
- при удалении пользователя его attempts удаляются каскадно через `on delete cascade`

Cleanup реализован через `pg_cron`:
- migration: `supabase/migrations/20260430190000_schedule_ai_attempt_cleanup.sql`
- job name: `cleanup_ai_generation_attempts`
- schedule: `20 3 * * *`
- команда удаляет только attempts старше retention window

```sql
delete from public.reading_generation_attempts
where created_at < now() - interval '90 days';
```

Прямой frontend-вызов cleanup недопустим.

## 4) Проверка scheduled cleanup
Проверить, что `pg_cron` включен:

```sql
select extname, extversion
from pg_extension
where extname = 'pg_cron';
```

Проверить, что cleanup job зарегистрирована:

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'cleanup_ai_generation_attempts';
```

Проверить, что scheduler-процесс работает:

```sql
select
  pid as process_id,
  usename as database_user,
  application_name,
  state,
  backend_type
from pg_stat_activity
where application_name ilike 'pg_cron scheduler';
```

Проверить историю запусков job:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'cleanup_ai_generation_attempts'
)
order by start_time desc
limit 10;
```

## 5) Что можно хранить в attempt metadata
Допустимые поля:
- `prompt_version`
- `model_chain`
- `provider`
- `model`
- `target_level`
- `reading_minutes`
- `target_word_min`
- `target_word_max`
- `validation_word_min`
- `validation_word_max`
- `max_tokens`
- `output_word_count`
- `fallback_used`
- `duration_ms`
- `failure_stage`
- `error_code`
- sanitized `error_message`

## 6) Что нельзя хранить
В `reading_generation_attempts` нельзя писать:
- полный prompt
- raw provider response
- полный generated text
- Telegram `initData`
- Telegram user payload
- server env secrets
- stack trace
- provider API key
- service role key

## 7) Failure stages
Допустимые значения `failure_stage`:
- `provider_request` — не удалось выполнить запрос к provider или случился timeout
- `provider_response` — provider вернул ошибку, пустой content, не-JSON API response или неподдерживаемую модель
- `output_validation` — ответ модели получен, но не прошел app-level validation
- `db_save` — валидный текст не удалось сохранить в БД
- `unknown` — ошибка не классифицирована

## 8) Diagnostic SQL
Все запросы ниже предназначены для server-side диагностики.
Не добавлять эти выборки напрямую во frontend.

### Ошибки по stage за последние 7 дней

```sql
select
  failure_stage,
  count(*) as failed_attempts
from public.reading_generation_attempts
where status = 'failed'
  and created_at >= now() - interval '7 days'
group by failure_stage
order by failed_attempts desc;
```

### Error rate по моделям за последние 7 дней

```sql
select
  coalesce(model, 'unknown') as model,
  count(*) as total_attempts,
  count(*) filter (where status = 'failed') as failed_attempts,
  round(
    100.0 * count(*) filter (where status = 'failed') / nullif(count(*), 0),
    2
  ) as failure_rate_percent
from public.reading_generation_attempts
where created_at >= now() - interval '7 days'
group by model
order by failure_rate_percent desc nulls last, total_attempts desc;
```

### Latency по успешным генерациям

```sql
select
  percentile_cont(0.5) within group (order by duration_ms) as p50_duration_ms,
  percentile_cont(0.95) within group (order by duration_ms) as p95_duration_ms,
  avg(duration_ms)::int as avg_duration_ms,
  max(duration_ms) as max_duration_ms
from public.reading_generation_attempts
where status = 'succeeded'
  and duration_ms is not null
  and created_at >= now() - interval '7 days';
```

### Частота fallback

```sql
select
  count(*) filter (where fallback_used is true) as fallback_attempts,
  count(*) filter (where fallback_used is false) as primary_model_attempts,
  count(*) as succeeded_attempts,
  round(
    100.0 * count(*) filter (where fallback_used is true) / nullif(count(*), 0),
    2
  ) as fallback_rate_percent
from public.reading_generation_attempts
where status = 'succeeded'
  and created_at >= now() - interval '7 days';
```

### Output validation failures

```sql
select
  error_code,
  error_message,
  count(*) as failed_attempts
from public.reading_generation_attempts
where status = 'failed'
  and failure_stage = 'output_validation'
  and created_at >= now() - interval '7 days'
group by error_code, error_message
order by failed_attempts desc;
```

### Проверка retention backlog

```sql
select
  count(*) as attempts_older_than_90_days,
  min(created_at) as oldest_attempt_at
from public.reading_generation_attempts
where created_at < now() - interval '90 days';
```

## 9) Production follow-up
Перед production нужно:
- добавить dashboard или сохраненные server-side SQL snippets для диагностики
- добавить alerting по росту `provider_request`, `provider_response`, `output_validation`
- определить отдельную privacy policy для пользовательских материалов в `user_completed_reading_texts`
