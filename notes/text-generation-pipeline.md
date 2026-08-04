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
6. Если генерация успешна, новый текст сохраняется как активный с `reading_date` текущей учебной даты и заменяет предыдущий активный текст.
7. Если пользователь не нажал `Завершить текст` перед новой успешной генерацией, предыдущий активный текст теряется и не попадает в историю.
8. Если пользователь не завершил текст до смены учебной даты, этот active text бессрочно остается в дневном плане до завершения или успешной замены.
9. Если генерация неуспешна, попытка остается списанной, новый текст не сохраняется, ранее активный текст остается доступен.
10. После нажатия `Завершить текст` фронт вызывает `complete-reading-text`; единственный active text сохраняется в историю с текущей учебной датой, удаляется из активного состояния, а генерация в этот учебный день остается доступна, пока не исчерпан дневной лимит.

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
6. Считает учебную дату с границей `05:00 Europe/Moscow`.
7. Атомарно проверяет дневной лимит и записывает попытку со статусом `started` через RPC `claim_reading_generation_attempt`.
8. Если лимит не исчерпан, продолжает генерацию; если исчерпан, возвращает `429`.
9. Проверяет OpenRouter model chain через allowlist.
10. Передает генерацию в `ai-pipeline.ts`.
11. AI-пайплайн строит prompt messages с `promptVersion`.
12. Вызывает OpenRouter с `models` parameter и приоритетным списком free-моделей.
13. Если router-level fallback не помог или ответ пришел с невалидным JSON/длиной/content pattern, приложение исключает использованную модель и пробует следующую.
14. Валидирует JSON-ответ модели как недоверенный output.
15. Записывает безопасные observability metadata в `public.reading_generation_attempts`.
16. При успехе сохраняет/перезаписывает `public.user_active_reading_texts` с `reading_date` и явно сбрасывает `last_read_paragraph_index` в `null`.
17. Помечает попытку как `succeeded`; при ошибке после списания помечает как `failed`.
18. Возвращает единый контракт:
- успех: `{ ok: true, data: { text, generation, dailyLimit, usedAttempts, remainingAttempts } }`
- ошибка: `{ ok: false, error: { code, message } }`

Дополнительные Edge Functions:
- `supabase/functions/get-reading-state/index.ts` — возвращает состояние экрана чтения и единственный active text пользователя независимо от даты генерации.
- `supabase/functions/complete-reading-text/index.ts` — транзакционно завершает единственный active text независимо от даты генерации через RPC `complete_daily_reading_text`, сохраняет snapshot с текущей учебной датой в историю, удаляет active text, заполняет `users.first_text_completed_at` для онбординга, если это первый прочитанный текст, и best-effort возвращает `streakDays` и `completedReadingTextCount`.
- `supabase/functions/get-reading-history/index.ts` — возвращает историю прочитанных текстов текущего пользователя с cursor-пагинацией.
- `supabase/functions/auth-telegram/index.ts` — в bootstrap пользователя отдает `homeProgress.lesson`, `homeProgress.reading.status`, `streakDays` и nullable `completedReadingTextCount` для главного экрана; ошибка подсчета истории не блокирует авторизацию.
- `supabase/functions/_shared/reading-streak.ts` — server helper для streak чтения: при наличии completion текущей учебной даты считает непрерывную серию от нее, а до сегодняшнего чтения сохраняет серию, завершенную вчера; возвращает `0`, если предыдущий учебный день полностью пропущен.
- `supabase/functions/_shared/reading-history.ts` — server helper общего счетчика истории; при ошибке агрегатного запроса возвращает `null`.
- `supabase/functions/_shared/reading-completion-metrics.ts` — изолирует post-completion расчет серии и счетчика от результата уже выполненной транзакции завершения.

## 4) OpenRouter
Server env:
- `OPENROUTER_API_KEY` — обязательный; локально хранится в gitignored `.env.telegram.local`, в production — в Supabase Cloud Edge Function secrets
- `OPENROUTER_MODEL_CHAIN` — опциональный comma-separated список моделей для генерации текста
- `OPENROUTER_MODEL_PRIMARY` / `OPENROUTER_MODEL_FALLBACK` /
  `OPENROUTER_MODEL_TERTIARY` — опциональные добавления к дефолтной цепочке,
  используются после текущих дефолтных моделей, если `OPENROUTER_MODEL_CHAIN`
  не задан

Текущие дефолты:
- `qwen/qwen3-next-80b-a3b-instruct:free`
- `nvidia/nemotron-nano-9b-v2:free`
- `google/gemma-4-31b-it:free`
- `google/gemma-4-26b-a4b-it:free`
- `openai/gpt-oss-20b:free`

Текущая стратегия:
- prompt version: `reading-text-v1`
- OpenRouter model chain проходит allowlist в `supabase/functions/_shared/openrouter.ts`
- на запрос отправляется массив моделей через OpenRouter `models` parameter
- запрос использует `response_format: { type: "json_object" }`
- запрос ограничивает reasoning через `reasoning: { effort: "low", exclude: true }`, чтобы reasoning-модели оставляли token budget для финального JSON
- OpenRouter делает router-level failover для provider/infra ошибок
- пустой content и другие app-detected `provider_response` ошибки исключают фактически ответившую модель и запускают запрос по оставшейся цепочке
- если успешный ответ пришел, но не прошел app-level валидацию JSON, длины или content safety, Edge Function исключает использованную модель и повторяет запрос по оставшемуся списку
- timeout одного запроса к OpenRouter: `25` секунд
- общий budget генерации текста: `90` секунд
- `provider_response` и `provider_request` ошибки пробуют следующую модель, пока в цепочке есть кандидаты и общий budget не исчерпан
- server logs для provider response содержат только безопасные metadata: модель, `finish_reason`, provider HTTP status/error code, completion token count и reasoning token count; raw response, generated content и reasoning text не логируются
- `reading_generation_attempts` хранит metadata попытки: `prompt_version`, `model_chain`, target/validation word ranges, `max_tokens`, `output_word_count`, `fallback_used`, `duration_ms`, `failure_stage`, `error_code`, sanitized `error_message`

`// TODO:` после изменения server env для OpenRouter или кода `generate-reading-text` перезапускать `npm run dev:telegram`, чтобы локальная среда подняла актуальную версию Edge Function

Важно:
- ключ OpenRouter нельзя добавлять во frontend env (`VITE_*`)
- ключ нельзя коммитить
- `.env.production.example` и `.env.telegram.example` содержат только названия переменных и безопасные placeholder/example значения

## 5) Размер текста
Время чтения управляет и промптом, и `max_tokens`.

Текущая таблица:
- `3` мин: `120-180` слов, `max_tokens: 700`
- `5` мин: `220-320` слов, `max_tokens: 1050`
- `10` мин: `450-650` слов, `max_tokens: 1800`
- `15` мин: `700-950` слов, `max_tokens: 2600`

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
6. Если AI-ветка упала, frontend не вызывает RPC fallback; он показывает ошибку, сохраняет последний active text на экране после завершения загрузки и повторно запрашивает `get-reading-state`, чтобы синхронизировать оставшиеся попытки с сервером.

## 7) Dev-индикатор источника
Файл:
- `src/screens/ReadingScreen.tsx`

В dev-режиме рядом с заголовком текста показывается:
- `AI · <model>` — если текст пришел из AI

В production этот индикатор не показывается.

## 8) Дневные попытки и активный текст
Таблицы:
- `public.reading_generation_attempts` — история списанных попыток генерации.
- `public.user_active_reading_texts` — последний успешный непрочитанный текст пользователя с `reading_date` и nullable-позицией абзаца; `null` означает абсолютный верх страницы.
- `public.user_daily_reading_completions` — дневной marker: пользователь завершил хотя бы один текст за дату.
- `public.user_completed_reading_texts` — snapshot каждого завершенного текста для раздела `Мои материалы`.

Правила MVP:
- учебный день начинается в `05:00 Europe/Moscow`
- дневной лимит зависит от подписки:
  - free: `3`
  - paid: `10`
- попытка списывается до запроса к OpenRouter
- попытка списывается независимо от успеха генерации
- при новой успешной генерации active text перезаписывается и получает `reading_date` текущей учебной даты
- при ошибке генерации существующий active text не меняется
- active text отображается и переносится бессрочно независимо от `reading_date`, пока пользователь не завершит или успешно не заменит его
- attempt metadata не хранит полный prompt, raw provider response, полный сгенерированный текст, Telegram `initData`, server env secrets или stack trace
- после завершения чтения active text сохраняется в историю с текущей учебной датой и удаляется из active-состояния; генерация в этот же учебный день остается доступна, пока не исчерпан дневной лимит
- `users.first_text_completed_at` используется только для онбординга
- статус карточки урока на главной определяется сервером через `homeProgress.lesson`
- статус блока `Текст` в карточке дневного прогресса определяется сервером через `homeProgress.reading.status`
- плитка `Тексты` на главной показывает server-side количество строк истории через `completedReadingTextCount`; для `null` используется подпись `История чтения`

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
- расширить automated tests на остальные варианты AI output validation
