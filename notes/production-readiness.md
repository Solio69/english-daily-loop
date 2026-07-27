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
- Текущий MVP-лимит зависит от effective access:
  - free: `3`
  - paid/internal: `10`
- Попытка считается списанной после записи attempt перед OpenRouter, независимо от успеха генерации.
- Проверка дневного лимита и запись attempt объединены в RPC `claim_reading_generation_attempt`, который использует transaction-level advisory lock на `user_id + attempt_date`.
- Перед production стоит:
  - добавить более явные user-facing сообщения для `429`

## 5) Generated text persistence
- Последний успешный непрочитанный AI-текст сохраняется в `user_active_reading_texts` с `reading_date` учебной даты генерации.
- Экран чтения и главный прогресс используют единственный active text пользователя независимо от даты генерации; незавершенный текст переносится бессрочно.
- Прочитанные тексты сохраняются в `user_completed_reading_texts`: при завершении единственный active text копируется в историю отдельной записью с текущей учебной датой, затем удаляется, а факт первого завершения учебного дня пишется в `user_daily_reading_completions`.
- Само завершение чтения выполняется транзакционно через RPC `complete_daily_reading_text` с проверкой владельца и row lock, но без date-фильтра active text.
- Перед production стоит добавить retention/экспорт/удаление пользовательских материалов, если появятся требования по приватности данных.

## 6) OpenRouter/free model reliability
- Free-модели могут быть временно недоступны или менять доступные endpoints.
- В MVP дефолтная цепочка free-моделей для чтения: `qwen/qwen3-next-80b-a3b-instruct:free` -> `nvidia/nemotron-nano-9b-v2:free` -> `google/gemma-4-31b-it:free` -> `google/gemma-4-26b-a4b-it:free` -> `openai/gpt-oss-20b:free`.
- Для infra/provider ошибок используется OpenRouter `models` parameter, а app-level валидация JSON/длины остается в Edge Function.
- Перед production стоит:
  - проверить платный/стабильный fallback
  - настроить rate limits
  - добавить retry policy для временных ошибок
  - отдельно обрабатывать ошибки формата/длины ответа модели

## 7) Secrets and environment
- `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` должны оставаться только на сервере.
- Frontend может видеть только `VITE_*` переменные.
- Production env split зафиксирован в `notes/production-env.md`: публичные frontend env живут в Vercel, server-only secrets живут в Supabase Edge Function secrets.
- Перед production проверить, что реальные секреты не попали в git history и логи.

## 7.1) Deployment platform
- Для первого production-релиза выбран путь `Supabase Cloud + Vercel`.
- Frontend хостится на Vercel как Vite static build.
- Backend/data слой остается в Supabase Cloud: Postgres, RLS/grants, Edge Functions, secrets, logs и backups.
- Решение, fallback-варианты и открытые вопросы зафиксированы в `notes/deployment-platform-decision.md`.
- Ручной runbook первого production-деплоя зафиксирован в `notes/production-deploy-flow.md`.
- Ручной smoke checklist production-деплоя зафиксирован в `notes/production-smoke-checklist.md`.
- `DEV_TOOLS_ENABLED` включен на первый production testing period только для admin-доступа; после стабильного запуска нужно выключить его или сократить production actions до безопасного subset.

## 8) Database API hardening
- Защищенные таблицы доступны через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.
- Для `anon` и `authenticated` закрыт прямой доступ к пользовательским, reading-state,
  completion/history и subscription таблицам.
- Критичные RPC доступны только `service_role`.
- Перед production стоит добавить automated smoke checks на прямой anon-доступ к таблицам
  и server-only RPC.

## 9) MVP subscriptions
- Пользовательский subscription flow скрыт, пока реальные платежи не подключены.
- Edge Function `activate-subscription` закрыта server env `SUBSCRIPTION_FLOW_ENABLED`.
- Роли `admin` и `tester` получают internal paid-like доступ через `users.app_role`.
- Активация MVP-подписки выполняется транзакционно через RPC `activate_mvp_subscription`.
- RPC использует advisory lock на пользователя, чтобы параллельные запросы оформления не создавали дубли active/scheduled подписок.
- Перед production при подключении реальных платежей нужно будет связать эту операцию с платежным provider event/webhook и идемпотентным payment id.

## 10) Support diagnostics
- Пользовательский отчет об ошибке отправляется из настроек через `submit-support-report`.
- Клиентский diagnostic buffer хранится в `sessionStorage` и отправляется только вручную.
- Все Edge Function вызовы с клиента получают `x-request-id`; ошибки AI могут возвращать safe diagnostics без prompt, raw provider response, полного текста, secrets и stack trace.
- Safe AI diagnostics собираются через `supabase/functions/_shared/ai-diagnostics.ts`, а доменные функции добавляют только безопасные поля конкретного сценария.
- `public.support_reports` закрыта для `anon` и `authenticated`; запись идет через Edge Function с `SUPABASE_SERVICE_ROLE_KEY`.
- Отчеты хранятся `30` дней и очищаются через `pg_cron` job `cleanup_support_reports`.
- Перед production стоит добавить удобный admin-view или SQL-шаблон для просмотра свежих отчетов без ручного поиска по таблице.

## 11) Минимизация пользовательских данных
- `users.telegram_user_id` хранится только как server-side идентификатор для Telegram auth и будущих сообщений бота.
- `users.first_name` используется для персонального приветствия.
- Приложение не собирает `username`, `last_name` и `language_code`; совместимые nullable-столбцы остаются в схеме до отдельного contract cleanup.
- Frontend user contract, новые support reports и прикладные логи не содержат прямой Telegram ID.
- Новые support reports связаны с пользователем только через внутренний `user_id`; совместимый nullable-столбец `support_reports.telegram_user_id` остается до contract cleanup.
- Contract cleanup допускается только после успешного production rollout текущего runtime-контракта и проверки backup/restore flow.
- Self-service удаление аккаунта и экспорт пользовательских данных остаются отдельными product/privacy задачами.
- Полная карта хранения и сроков зафиксирована в `notes/user-data-storage.md`.
