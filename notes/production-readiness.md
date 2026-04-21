# Production readiness notes

Этот файл фиксирует вещи, которые можно оставить в MVP, но нужно пересмотреть
перед production-версией.

## 1) AI generation observability
- Сейчас `readingService` тихо переключается на DB fallback, если AI-генерация упала.
- Dev-бейдж `AI / DB` помогает локально, но production-диагностика должна быть серверной:
  - structured logs
  - error code
  - provider/model
  - причина fallback
  - correlation/request id, если появится backend-сессия

## 2) Telegram initData validation reuse
- `auth-telegram` и `generate-reading-text` сейчас имеют похожую серверную проверку `initData`.
- Для MVP это нормально.
- Если появится еще одна Edge Function с Telegram auth, стоит вынести общую проверку в общий модуль.

## 3) DB fallback length
- AI-текст учитывает `daily_reading_minutes`.
- RPC fallback `get_random_reading_text` пока не учитывает время чтения.
- Если AI упал, пользователь может получить DB-текст не той длины, которую выбрал в настройках.
- Перед production стоит:
  - добавить длину/минуты в `reading_texts`
  - фильтровать fallback по `daily_reading_minutes`
  - или явно показывать, что выдан fallback-текст.

## 4) Generation attempts
- UI сейчас показывает моковое значение попыток генерации.
- Серверный учет лимита генераций пока не реализован.
- Перед production нужно решить:
  - дневной или недельный лимит
  - где хранить счетчик
  - что считается попыткой: только успешная генерация или любой AI-запрос
  - что делать при DB fallback

## 5) Generated text persistence
- Сейчас AI-тексты не сохраняются в БД.
- Это упрощает MVP, но ограничивает аналитику и повторное открытие текста.
- Перед production стоит решить, сохраняем ли:
  - `user_id`
  - `title`
  - `body`
  - `level`
  - `estimated_minutes`
  - `provider`
  - `model`
  - `fallback_used`
  - `created_at`

## 6) OpenRouter/free model reliability
- Free-модели могут быть временно недоступны или менять доступные endpoints.
- Перед production стоит:
  - проверить платный/стабильный fallback
  - настроить rate limits
  - добавить retry policy для временных ошибок
  - отдельно обрабатывать ошибки формата/длины ответа модели

## 7) Secrets and environment
- `OPENROUTER_API_KEY`, `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` должны оставаться только на сервере.
- Frontend может видеть только `VITE_*` переменные.
- Перед production проверить, что реальные секреты не попали в git history и логи.

