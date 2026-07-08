# SQL snippets for support triage

Use these queries as read-only diagnostics. Replace placeholders before running.

## Latest reports

```sql
select
  id,
  created_at,
  telegram_user_id,
  app_role,
  current_screen,
  user_comment,
  request_ids,
  ai_diagnostics
from public.support_reports
order by created_at desc
limit 20;
```

## Report by id

```sql
select *
from public.support_reports
where id = 'PASTE_REPORT_ID_HERE';
```

## AI diagnostics from reports

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
order by sr.created_at desc
limit 50;
```

## Events for one report

```sql
select
  event.item->>'createdAt' as event_time,
  event.item->>'level' as level,
  event.item->>'event' as event_name,
  event.item->'details' as details
from public.support_reports sr
cross join lateral jsonb_array_elements(sr.events) as event(item)
where sr.id = 'PASTE_REPORT_ID_HERE'
order by event.item->>'createdAt';
```

## Find report by request id

```sql
select
  id,
  created_at,
  telegram_user_id,
  current_screen,
  user_comment,
  request_ids
from public.support_reports
where request_ids @> array['PASTE_REQUEST_ID_HERE']::text[]
order by created_at desc;
```

## Reading generation attempts near a report

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

## Vocabulary card attempts near a report

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

## Recent AI failure summary

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
