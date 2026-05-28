# Production readiness notes

Этот файл фиксирует вещи, которые можно оставить в MVP, но нужно пересмотреть
перед production-версией.

## 1) AI generation observability
- `readingService` при ошибке AI возвращает ошибку и сохраняет последний активный текст доступным в UI.
- Попытка генерации списывается до запроса к OpenRouter, а неуспешная попытка помечается в `reading_generation_attempts.status = 'failed'`.
- `reading_generation_attempts` хранит безопасные metadata: provider/model, prompt version, model chain, target/validation ranges, output word count, fallback flag, duration, failure stage, error code и sanitized error message.
- Полный prompt, raw provider response, полный generated text, Telegram `initData`, secrets и stack trace не пишутся в attempt metadata.
- Retention policy для AI attempt metadata зафиксирована в `notes/ai-observability-diagnostics.md`: operational diagnostics window `90` дней.
- Scheduled cleanup выполняется через `pg_cron` job `cleanup_ai_generation_attempts`.
- Ручные adversarial-проверки AI-пайплайна зафиксированы в `notes/ai-red-team-checklist.md`.
- Перед production стоит:
  - добавить correlation/request id, если появится backend-сессия
  - добавить dashboard/alerting по `failure_stage`, latency и provider/model error rate

## 2) Edge Functions shared server helper
- Общая server-инфраструктура Edge Functions находится в `supabase/functions/_shared/server.ts`.
- Helper покрывает CORS, POST guard, JSON parsing, чтение env, Telegram `initData` validation, `AppError` и единый формат JSON-ответов.
- Чувствительные функции возвращают Telegram validation как `401 AUTH_VALIDATION_FAILED`; неожиданные внутренние ошибки возвращаются как `5xx` с безопасным сообщением для клиента, а технические детали остаются в server logs.
- Перед production стоит добавить CI-проверку Edge Functions в Deno runtime и smoke tests на auth/error-контракты, чтобы общий helper не расходился с контрактами frontend.

## 3) DB fallback length
- AI-текст учитывает `daily_reading_minutes`.
- Текущий UI генерации не использует RPC fallback `get_random_reading_text`.
- Если fallback вернется как отдельный продуктовый сценарий, перед production стоит:
  - добавить длину/минуты в `reading_texts`
  - фильтровать fallback по `daily_reading_minutes`
  - или явно показывать, что выдан fallback-текст.

## 4) Generation attempts
- Серверный учет дневного лимита реализован через `reading_generation_attempts`.
- День считается по `Europe/Moscow`.
- Текущий MVP-лимит зависит от активной подписки:
  - free: `3`
  - paid: `10`
- Попытка считается списанной после записи attempt перед OpenRouter, независимо от успеха генерации.
- Проверка дневного лимита и запись attempt объединены в RPC `claim_reading_generation_attempt`, который использует transaction-level advisory lock на `user_id + attempt_date`.
- Перед production стоит:
  - добавить более явные user-facing сообщения для `429`

## 5) Generated text persistence
- Последний успешный непрочитанный AI-текст сохраняется в `user_active_reading_texts`.
- Прочитанные тексты сохраняются в `user_completed_reading_texts`: при завершении активный текст копируется в историю отдельной записью, затем active text удаляется, а факт первого завершения дня пишется в `user_daily_reading_completions`.
- Само завершение чтения выполняется транзакционно через RPC `complete_daily_reading_text`.
- Перед production стоит добавить retention/экспорт/удаление пользовательских материалов, если появятся требования по приватности данных.

## 6) OpenRouter/free model reliability
- Free-модели могут быть временно недоступны или менять доступные endpoints.
- В MVP цепочка free-моделей для чтения: `openai/gpt-oss-20b:free` -> `qwen/qwen3.6-plus:free`.
- Для infra/provider ошибок используется OpenRouter `models` parameter, а app-level валидация JSON/длины остается в Edge Function.
- Перед production стоит:
  - проверить платный/стабильный fallback
  - настроить rate limits
  - добавить retry policy для временных ошибок
  - отдельно обрабатывать ошибки формата/длины ответа модели

## 7) Secrets and environment
- `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` должны оставаться только на сервере.
- Frontend может видеть только `VITE_*` переменные.
- Перед production проверить, что реальные секреты не попали в git history и логи.

## 8) Database API hardening
- Защищенные таблицы доступны через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.
- Для `anon` и `authenticated` закрыт прямой доступ к пользовательским, reading-state,
  completion/history и subscription таблицам.
- Критичные RPC доступны только `service_role`.
- Перед production стоит добавить automated smoke checks на прямой anon-доступ к таблицам
  и server-only RPC.

## 9) MVP subscriptions
- Активация MVP-подписки выполняется транзакционно через RPC `activate_mvp_subscription`.
- RPC использует advisory lock на пользователя, чтобы параллельные запросы оформления не создавали дубли active/scheduled подписок.
- Перед production при подключении реальных платежей нужно будет связать эту операцию с платежным provider event/webhook и идемпотентным payment id.
