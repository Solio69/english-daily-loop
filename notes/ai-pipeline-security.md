# AI pipeline security

## 1) Назначение
Документ фиксирует текущую security-модель AI-пайплайна генерации текстов для чтения.
Главный принцип: LLM и внешний provider считаются недоверенными компонентами.
Модель генерирует candidate text, а сервер решает, можно ли сохранить и показать результат пользователю.

## 2) Архитектурные границы
AI-пайплайн разделен на слои:
- request guard в `supabase/functions/generate-reading-text/index.ts`
- prompt/output слой в `supabase/functions/generate-reading-text/ai-pipeline.ts`
- общий OpenRouter client и model allowlist в `supabase/functions/_shared/openrouter.ts`
- общие проверки AI-текста в `supabase/functions/_shared/ai-text.ts`
- persistence boundary в таблице `public.user_active_reading_texts`
- попытки и observability в `public.reading_generation_attempts`

`index.ts` отвечает за:
- Telegram `initData` validation
- поиск текущего пользователя
- настройки чтения
- дневной completion
- дневной лимит и атомарное списание попытки через RPC
- сохранение только валидного результата

`ai-pipeline.ts` отвечает за:
- prompt version
- allowlist OpenRouter-моделей
- сборку prompt messages
- вызов OpenRouter
- app-level fallback между моделями
- parsing и validation ответа модели

## 3) Данные, которые можно отправлять в модель
В модель отправляются только учебные параметры:
- `english_level`
- `daily_reading_minutes`
- целевой диапазон слов

В модель нельзя отправлять:
- `Telegram initData`
- `TELEGRAM_BOT_TOKEN`
- `OPENROUTER_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- внутренний `user_id`
- `telegram_user_id`
- данные подписки
- историю пользователя без отдельного privacy-решения

## 4) Prompt и model governance
Текущий prompt version:
- `reading-text-v1`

Prompt считается частью кода:
- хранится в репозитории
- меняется через code review
- логируется по версии, а не полным текстом prompt

OpenRouter-модели проходят allowlist в `supabase/functions/_shared/openrouter.ts`.
Текущие разрешенные модели:
- `openai/gpt-oss-20b:free`
- `qwen/qwen3.6-plus:free`

Если server env указывает модель вне allowlist, Edge Function возвращает `AI_MODEL_CONFIG_INVALID`
до списания пользовательской попытки.

## 5) Output validation
Ответ модели считается недоверенным и проходит проверки:
- ответ должен быть JSON
- `title` должен быть строкой, 3-8 слов, до 80 символов
- `body` должен быть непустой строкой
- `estimatedMinutes` должен совпадать с настройкой пользователя
- `level` должен совпадать с настройкой пользователя
- длина `body` должна попадать в допустимый диапазон слов с допуском примерно `±20%`
- текст не должен содержать markdown code fences, HTML/script patterns, `javascript:` и явные признаки prompt leakage

Если provider вернул технически успешный ответ, но app-level validation не прошла,
пайплайн исключает использованную модель и пробует следующую модель из allowlist.

## 6) Persistence boundary
В `public.user_active_reading_texts` сохраняется только результат, прошедший server-side validation.
При ошибке генерации:
- попытка остается списанной, если она уже была создана
- attempt помечается как `failed`
- новый активный текст не сохраняется
- ранее активный текст остается доступным пользователю

## 7) Observability и политика хранения
`public.reading_generation_attempts` хранит безопасные metadata попытки:
- `prompt_version`
- `model_chain`
- `target_level`
- `reading_minutes`
- target/validation word ranges
- `max_tokens`
- `output_word_count`
- `fallback_used`
- `duration_ms`
- `failure_stage`
- `error_code`
- sanitized `error_message`

В attempt metadata не хранятся:
- полный prompt
- raw provider response
- полный сгенерированный текст
- Telegram `initData`
- Telegram user payload
- server env secrets
- stack trace

Допустимые `failure_stage`:
- `provider_request`
- `provider_response`
- `output_validation`
- `db_save`
- `unknown`

`error_message` используется только для короткой server-side диагностики. Значение нормализуется,
обрезается до 300 символов и не должно содержать prompt, raw response, секреты или stack trace.

## 8) Что остается production-задачей
- добавить Deno/Edge Functions checks в CI
- добавить automated tests на AI output validation
- добавить dashboard/alerting по AI diagnostics из `notes/ai-observability-diagnostics.md`
