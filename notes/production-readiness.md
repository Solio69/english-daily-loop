# Production readiness notes

Этот файл фиксирует вещи, которые можно оставить в MVP, но нужно пересмотреть
перед production-версией.

## 1) AI generation observability
- `readingService` больше не переключается на DB fallback при ошибке AI.
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
- `auth-telegram`, `generate-reading-text`, `get-reading-state` и `complete-reading-text` сейчас имеют похожую серверную проверку `initData`.
- Для MVP это нормально.
- Перед production стоит вынести общую проверку в общий модуль для Edge Functions.

## 3) DB fallback length
- AI-текст учитывает `daily_reading_minutes`.
- RPC fallback `get_random_reading_text` больше не используется в текущем UI генерации.
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
- Перед production стоит:
  - сделать атомарную DB/RPC-операцию "проверить лимит и списать попытку"
  - добавить более явные user-facing сообщения для `429` и `DAILY_READING_ALREADY_COMPLETED`

## 5) Generated text persistence
- Последний успешный непрочитанный AI-текст сохраняется в `user_active_reading_texts`.
- Прочитанные тексты пока не сохраняются: при завершении активный текст удаляется, а факт дня пишется в `user_daily_reading_completions`.
- Перед production стоит решить, сохраняем ли историю прочитанных текстов:
  - `user_id`
  - `title`
  - `body`
  - `level`
  - `estimated_minutes`
  - `provider`
  - `model`
  - `fallback_used`
  - `created_at`
  - `completed_at`

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
