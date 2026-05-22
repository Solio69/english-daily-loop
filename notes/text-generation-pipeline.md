# AI-генерация текста для чтения

## 1) Область документа
Этот документ фиксирует текущий MVP-пайплайн генерации текста для раздела `Текст`.
Цель: чтобы следующие агенты быстро понимали, где проходит граница между фронтом,
Supabase Edge Function, базой и внешней AI-моделью.

## 2) Текущий пользовательский сценарий
1. Пользователь выбирает настройки сессии:
- уровень текста: `A1`, `A2`, `B1`, `B2`
- время чтения: `3`, `5`, `10`, `15` минут

2. Пользователь открывает раздел `Текст`.
3. Фронт вызывает `src/services/readingService.ts`.
4. Сервис вызывает Edge Function `get-reading-state` и получает:
- активный непрочитанный текст, если он уже был сгенерирован
- дневной лимит попыток
- количество использованных/оставшихся попыток
- флаг `isReadingCompletedToday`
5. Если дневные попытки остались, пользователь может вызвать `generate-reading-text`.
6. Если генерация успешна, новый текст сохраняется как активный и заменяет предыдущий активный текст.
7. Если пользователь не нажал `Завершить текст` перед новой успешной генерацией, предыдущий активный текст теряется и не попадает в историю.
8. Если генерация неуспешна, попытка остается списанной, новый текст не сохраняется, ранее активный текст остается доступен.
9. После нажатия `Завершить текст` фронт вызывает `complete-reading-text`; активный текст сохраняется в историю, удаляется из активного состояния, а генерация в этот же день остается доступна, пока не исчерпан дневной лимит.

## 3) Серверная функция
Файлы:
- `supabase/functions/generate-reading-text/index.ts`
- `supabase/functions/generate-reading-text/ai-pipeline.ts`
- `supabase/functions/_shared/openrouter.ts`
- `supabase/functions/_shared/ai-text.ts`

Функция делает:
1. Принимает `initData` из Telegram Mini App.
2. Валидирует `initData` на сервере через `TELEGRAM_BOT_TOKEN`.
3. Достает `telegram_user_id`.
4. Находит пользователя в `public.users`.
5. Читает из `public.user_settings`:
- `english_level`
- `daily_reading_minutes`
6. Считает текущую дату по `Europe/Moscow`.
7. Атомарно проверяет дневной лимит и записывает попытку со статусом `started` через RPC `claim_reading_generation_attempt`.
8. Если лимит не исчерпан, продолжает генерацию; если исчерпан, возвращает `429`.
9. Проверяет OpenRouter model chain через allowlist.
10. Передает генерацию в `ai-pipeline.ts`.
11. AI-пайплайн строит prompt messages с `promptVersion`.
12. Вызывает OpenRouter с `models` parameter и приоритетным списком free-моделей.
13. Если router-level fallback не помог или ответ пришел с невалидным JSON/длиной/content pattern, приложение исключает использованную модель и пробует следующую.
14. Валидирует JSON-ответ модели как недоверенный output.
15. Записывает безопасные observability metadata в `public.reading_generation_attempts`.
16. При успехе сохраняет/перезаписывает `public.user_active_reading_texts`.
17. Помечает попытку как `succeeded`; при ошибке после списания помечает как `failed`.
18. Возвращает единый контракт:
- успех: `{ ok: true, data: { text, generation, dailyLimit, usedAttempts, remainingAttempts } }`
- ошибка: `{ ok: false, error: { code, message } }`

Дополнительные Edge Functions:
- `supabase/functions/get-reading-state/index.ts` — возвращает состояние экрана чтения.
- `supabase/functions/complete-reading-text/index.ts` — транзакционно завершает активный текст через RPC `complete_daily_reading_text`, сохраняет snapshot текста в историю, удаляет активный текст, заполняет `users.first_text_completed_at` для онбординга, если это первый прочитанный текст, и возвращает актуальный `streakDays`.
- `supabase/functions/get-reading-history/index.ts` — возвращает историю прочитанных текстов текущего пользователя с cursor-пагинацией.
- `supabase/functions/auth-telegram/index.ts` — в bootstrap пользователя отдает `homeProgress.lesson`, `homeProgress.reading.status` и `streakDays` для главного экрана.

## 4) OpenRouter
Server env:
- `OPENROUTER_API_KEY` — обязательный, только в `.env.local`
- `OPENROUTER_MODEL_PRIMARY` — опциональный
- `OPENROUTER_MODEL_FALLBACK` — опциональный
- `OPENROUTER_MODEL_TERTIARY` — опциональный

Текущие дефолты:
- primary: `openai/gpt-oss-20b:free`
- fallback: `google/gemma-3-12b-it:free`
- tertiary: `qwen/qwen3.6-plus:free`

Текущая стратегия:
- prompt version: `reading-text-v1`
- OpenRouter model chain проходит allowlist в `supabase/functions/_shared/openrouter.ts`
- на запрос отправляется массив моделей через OpenRouter `models` parameter
- OpenRouter делает router-level failover для provider/infra ошибок
- если успешный ответ пришел, но не прошел app-level валидацию JSON, длины или content safety, Edge Function исключает использованную модель и повторяет запрос по оставшемуся списку
- timeout запроса к OpenRouter: `45` секунд
- `reading_generation_attempts` хранит metadata попытки: `prompt_version`, `model_chain`, target/validation word ranges, `max_tokens`, `output_word_count`, `fallback_used`, `duration_ms`, `failure_stage`, `error_code`, sanitized `error_message`

`// TODO:` после изменения server env для OpenRouter или кода `generate-reading-text` перезапускать `npm run dev:telegram`, чтобы локальная среда подняла актуальную версию Edge Function

Важно:
- ключ OpenRouter нельзя добавлять во frontend env (`VITE_*`)
- ключ нельзя коммитить
- `.env.example` содержит только названия переменных и безопасные placeholder/example значения

## 5) Размер текста
Время чтения управляет и промптом, и `max_tokens`.

Текущая таблица:
- `3` мин: `120-180` слов, `max_tokens: 450`
- `5` мин: `220-320` слов, `max_tokens: 750`
- `10` мин: `450-650` слов, `max_tokens: 1300`
- `15` мин: `700-950` слов, `max_tokens: 1900`

Валидация:
- модель должна вернуть JSON
- `title` должен быть строкой, 3-8 слов, до 80 символов
- `body` должен попадать в диапазон слов с допуском примерно `±20%`
- `estimatedMinutes` в ответе модели должен совпадать с настройкой пользователя
- `level` в ответе модели должен совпадать с уровнем пользователя
- `title` и `body` не должны содержать markdown code fences, HTML/script patterns, `javascript:` и явные признаки prompt leakage

## 6) Frontend service
Файл:
- `src/services/readingService.ts`

Поведение:
1. Берет `window.Telegram.WebApp.initData`.
2. Для входа на экран вызывает `get-reading-state`.
3. Для генерации вызывает `generate-reading-text`.
4. Для завершения текста вызывает `complete-reading-text`.
5. Если ответ генерации успешный, возвращает `ReadingText` с:
- `source: "ai"`
- `generation.provider`
- `generation.model`
- `generation.fallbackUsed`
6. Если AI-ветка упала, frontend не вызывает RPC fallback; он показывает ошибку, сохраняет последний активный текст на экране после завершения загрузки и повторно запрашивает `get-reading-state`, чтобы синхронизировать оставшиеся попытки с сервером.

## 7) Dev-индикатор источника
Файл:
- `src/screens/ReadingScreen.tsx`

В dev-режиме рядом с заголовком текста показывается:
- `AI · <model>` — если текст пришел из AI

В production этот индикатор не показывается.

## 8) Дневные попытки и активный текст
Таблицы:
- `public.reading_generation_attempts` — история списанных попыток генерации.
- `public.user_active_reading_texts` — последний успешный непрочитанный текст пользователя.
- `public.user_daily_reading_completions` — дневной marker: пользователь завершил хотя бы один текст за дату.
- `public.user_completed_reading_texts` — snapshot каждого завершенного текста для раздела `Мои материалы`.

Правила MVP:
- timezone дневного цикла: `Europe/Moscow`
- дневной лимит зависит от подписки:
  - free: `3`
  - paid: `10`
- попытка списывается до запроса к OpenRouter
- попытка списывается независимо от успеха генерации
- при новой успешной генерации активный текст перезаписывается
- при ошибке генерации активный текст не меняется
- attempt metadata не хранит полный prompt, raw provider response, полный сгенерированный текст, Telegram `initData`, server env secrets или stack trace
- после завершения чтения активный текст сохраняется в историю и удаляется из active-состояния; генерация в этот же день остается доступна, пока не исчерпан дневной лимит
- `users.first_text_completed_at` используется только для онбординга
- статус карточки урока на главной определяется сервером через `homeProgress.lesson`
- статус блока `Текст` в карточке дневного прогресса определяется сервером через `homeProgress.reading.status`

## 9) Ограничения и будущие улучшения
Текущие ограничения:
- Генерация длинных текстов зависит от доступности free-моделей OpenRouter.
- Валидация длины работает по простому подсчету слов через whitespace.
- Дневной лимит генерации списывается атомарно через RPC.
- Завершение чтения выполняется транзакционно через RPC.
- `promptVersion` возвращается в ответе генерации, логируется на сервере и хранится в `reading_generation_attempts.prompt_version`.

Возможные следующие шаги:
- добавить retry только для ошибок длины, чтобы модель могла перегенерировать текст
- добавить Deno/Edge Functions checks в CI
- добавить automated tests на AI output validation и model allowlist
