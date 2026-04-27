# Production readiness notes

Этот файл фиксирует вещи, которые можно оставить в MVP, но нужно пересмотреть
перед production-версией.

## 1) AI generation observability
- `readingService` при ошибке AI возвращает ошибку и сохраняет последний активный текст доступным в UI.
- Попытка генерации списывается до запроса к OpenRouter, а неуспешная попытка помечается в `reading_generation_attempts.status = 'failed'`.
- Dev-бейдж `AI` помогает локально, но production-диагностика должна быть серверной:
  - structured logs
  - error code
  - provider/model
  - attempt id
  - remaining attempts
  - причина ошибки генерации
  - correlation/request id, если появится backend-сессия

## 2) Telegram initData validation reuse
- `auth-telegram`, `generate-reading-text`, `get-reading-state`, `complete-reading-text` и `get-reading-history` сейчас имеют похожую серверную проверку `initData`.
- Для MVP это нормально.
- `auth-telegram` разделяет ошибки validation и внутренние DB/server ошибки: Telegram validation возвращается как `401 AUTH_VALIDATION_FAILED`, а внутренние сбои как `5xx`.
- Перед production стоит вынести общую проверку в общий модуль для Edge Functions.

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
  - добавить более явные user-facing сообщения для `429` и `DAILY_READING_ALREADY_COMPLETED`

## 5) Generated text persistence
- Последний успешный непрочитанный AI-текст сохраняется в `user_active_reading_texts`.
- Прочитанные тексты сохраняются в `user_completed_reading_texts`: при завершении активный текст копируется в историю, затем active text удаляется, а факт дня пишется в `user_daily_reading_completions`.
- Само завершение чтения выполняется транзакционно через RPC `complete_daily_reading_text`.
- Перед production стоит добавить retention/экспорт/удаление пользовательских материалов, если появятся требования по приватности данных.

## 6) OpenRouter/free model reliability
- Free-модели могут быть временно недоступны или менять доступные endpoints.
- В MVP цепочка free-моделей для чтения: `openai/gpt-oss-20b:free` -> `google/gemma-3-12b-it:free` -> `qwen/qwen3.6-plus:free`.
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

## 8) MVP subscriptions
- Активация MVP-подписки выполняется транзакционно через RPC `activate_mvp_subscription`.
- RPC использует advisory lock на пользователя, чтобы параллельные запросы оформления не создавали дубли active/scheduled подписок.
- Перед production при подключении реальных платежей нужно будет связать эту операцию с платежным provider event/webhook и идемпотентным payment id.
