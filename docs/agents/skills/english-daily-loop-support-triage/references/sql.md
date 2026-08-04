# SQL snippets for support triage

Использовать только как read-only диагностику. Перед работой с production явно сообщить:
`Мы работаем с production БД`.

Правила выполнения:

- выполнять запросы по одному и ждать результат перед выбором следующего;
- начинать с count/date summary, затем получать минимальный список и выбирать конкретный report id;
- заменять `PASTE_..._HERE` только синтетическим или фактическим точечным значением;
- не добавлять в `select` `user_id`, `telegram_user_id`, полный `app_context`, полные `events` или другие поля «на всякий случай»;
- не использовать `select *`, DDL, DML, administrative operations или функции с побочными эффектами;
- не выполнять следующие запросы для записей, уже классифицированных как `тест / шум` или исключенных из scope.

## 1. Count/date summary

Первый запрос показывает только наличие и временной диапазон отчетов, которые еще хранятся по
retention policy.

```sql
select
  count(*) as total_reports,
  min(created_at) as first_report_at,
  max(created_at) as last_report_at
from public.support_reports;
```

Если владелец надежно зафиксировал время предыдущей проверки, можно ограничить тот же запрос:

```sql
select
  count(*) as total_reports,
  min(created_at) as first_report_at,
  max(created_at) as last_report_at
from public.support_reports
where created_at > 'PASTE_LAST_CHECKED_AT_HERE'::timestamptz;
```

## 2. Minimal report list

Выполнять только если summary показал отчеты. Запрос намеренно не возвращает идентификаторы
пользователя, request ids, полные events, AI diagnostics или app context.

```sql
select
  id,
  created_at,
  app_role,
  current_screen,
  user_comment,
  app_context->>'appVersion' as app_version,
  app_context->>'buildId' as build_id,
  app_context->>'environment' as environment,
  cardinality(request_ids) as request_id_count,
  jsonb_array_length(events) as event_count,
  jsonb_array_length(ai_diagnostics) as ai_diagnostic_count
from public.support_reports
order by created_at desc
limit 20;
```

Комментарий может содержать введенные пользователем личные данные. Перед передачей результата
маскировать такие фрагменты. После просмотра выбрать конкретные report id; тестовые и исключенные
записи больше не запрашивать. Если summary был ограничен временем предыдущей проверки, добавить
в этот запрос тот же `where created_at > 'PASTE_LAST_CHECKED_AT_HERE'::timestamptz` перед
`order by`.

## 3. Safe details for one report

Заменить placeholder конкретным id. Запрос оставляет app context свернутым до разрешенной release
metadata и не возвращает полные events.

```sql
select
  id,
  created_at,
  report_date,
  app_role,
  current_screen,
  user_comment,
  app_context->>'appVersion' as app_version,
  app_context->>'buildId' as build_id,
  app_context->>'environment' as environment,
  request_ids,
  jsonb_array_length(events) as event_count,
  jsonb_array_length(ai_diagnostics) as ai_diagnostic_count
from public.support_reports
where id = 'PASTE_REPORT_ID_HERE';
```

## 4. AI diagnostics for one report

Выполнять только для AI-сценария выбранного отчета. Полный prompt, raw provider response и
generated content не запрашиваются.

```sql
select
  sr.id as report_id,
  sr.created_at,
  diag.item->>'functionName' as function_name,
  diag.item->>'requestId' as request_id,
  diag.item->>'promptVersion' as prompt_version,
  diag.item->>'stage' as stage,
  diag.item->>'model' as model,
  diag.item->>'providerStatus' as provider_status,
  diag.item->>'providerErrorCode' as provider_error_code,
  diag.item->>'errorMessage' as error_message
from public.support_reports sr
cross join lateral jsonb_array_elements(sr.ai_diagnostics) as diag(item)
where sr.id = 'PASTE_REPORT_ID_HERE'
order by request_id;
```

## 5. Filtered events for one report

Запрос возвращает имена событий и только отдельные безопасные correlation/error metadata, а не
весь объект `details`. При необходимости добавить фильтр по релевантному `event_name`.

```sql
select
  event.item->>'createdAt' as event_time,
  event.item->>'level' as level,
  event.item->>'event' as event_name,
  event.item->'details'->>'requestId' as request_id,
  event.item->'details'->>'functionName' as function_name,
  event.item->'details'->>'code' as error_code
from public.support_reports sr
cross join lateral jsonb_array_elements(sr.events) as event(item)
where sr.id = 'PASTE_REPORT_ID_HERE'
order by event.item->>'createdAt';
```

## 6. Find report by request id

Использовать только когда request id уже известен из безопасной диагностики или Edge/API лога.

```sql
select
  id,
  created_at,
  current_screen
from public.support_reports
where request_ids @> array['PASTE_REQUEST_ID_HERE']::text[]
order by created_at desc;
```

## 7. Reading generation attempts near one report

`user_id` используется только внутри join для корреляции и не возвращается результатом.

```sql
select
  rga.id,
  rga.created_at,
  rga.status,
  rga.provider,
  rga.model,
  rga.prompt_version,
  rga.model_chain,
  rga.target_level,
  rga.reading_minutes,
  rga.output_word_count,
  rga.duration_ms,
  rga.failure_stage,
  rga.error_code,
  rga.error_message
from public.reading_generation_attempts rga
join public.support_reports sr on sr.user_id = rga.user_id
where sr.id = 'PASTE_REPORT_ID_HERE'
  and rga.created_at between sr.created_at - interval '30 minutes'
                         and sr.created_at + interval '5 minutes'
order by rga.created_at desc;
```

## 8. Vocabulary card attempts near one report

`user_id` используется только внутри join для корреляции и не возвращается результатом.

```sql
select
  vcga.id,
  vcga.created_at,
  vcga.status,
  vcga.provider,
  vcga.model,
  vcga.prompt_version,
  vcga.model_chain,
  vcga.requested_count,
  vcga.prepared_count,
  vcga.failed_count,
  vcga.merged_count,
  vcga.reactivated_count,
  vcga.duration_ms,
  vcga.error_code,
  vcga.error_message
from public.vocabulary_card_generation_attempts vcga
join public.support_reports sr on sr.user_id = vcga.user_id
where sr.id = 'PASTE_REPORT_ID_HERE'
  and vcga.created_at between sr.created_at - interval '30 minutes'
                         and sr.created_at + interval '5 minutes'
order by vcga.created_at desc;
```

## 9. Recent AI failure summary

Не является обязательным шагом. Использовать после разбора конкретного report id только если
нужно проверить, похож ли случай на более широкий внешний инцидент.

```sql
select
  'reading' as source,
  failure_stage,
  model,
  error_code,
  count(*) as count
from public.reading_generation_attempts
where status = 'failed'
  and created_at >= now() - interval '7 days'
group by failure_stage, model, error_code

union all

select
  'vocabulary_cards' as source,
  null as failure_stage,
  model,
  error_code,
  count(*) as count
from public.vocabulary_card_generation_attempts
where status = 'failed'
  and created_at >= now() - interval '7 days'
group by model, error_code
order by count desc;
```
