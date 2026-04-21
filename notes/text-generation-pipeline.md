# AI-генерация текста для чтения

## 1) Область документа
Этот документ фиксирует текущий MVP-пайплайн генерации текста для раздела `Текст`.
Цель: чтобы следующие агенты быстро понимали, где проходит граница между фронтом,
Supabase Edge Function, базой и внешней AI-моделью.

## 2) Текущий пользовательский сценарий
1. Пользователь выбирает настройки сессии:
- уровень текста: `A1`, `A2`, `B1`, `B2`
- время чтения: `3`, `5`, `10`, `15` минут
- время упражнений
- количество слов на повторение

2. Пользователь открывает раздел `Текст`.
3. Фронт вызывает `src/services/readingService.ts`.
4. Сервис сначала вызывает Edge Function `generate-reading-text`.
5. Если AI-генерация не сработала, сервис делает UX fallback на RPC
`get_random_reading_text`.

## 3) Серверная функция
Файл:
- `supabase/functions/generate-reading-text/index.ts`

Функция делает:
1. Принимает `initData` из Telegram Mini App.
2. Валидирует `initData` на сервере через `TELEGRAM_BOT_TOKEN`.
3. Достает `telegram_user_id`.
4. Находит пользователя в `public.users`.
5. Читает из `public.user_settings`:
- `english_level`
- `daily_reading_minutes`
6. Строит промпт для OpenRouter.
7. Вызывает primary-модель.
8. Если primary-модель упала, вызывает fallback-модель.
9. Валидирует JSON-ответ модели.
10. Возвращает единый контракт:
- успех: `{ ok: true, data: { text, generation } }`
- ошибка: `{ ok: false, error: { code, message } }`

## 4) OpenRouter
Server env:
- `OPENROUTER_API_KEY` — обязательный, только в `.env.local`
- `OPENROUTER_MODEL_PRIMARY` — опциональный
- `OPENROUTER_MODEL_FALLBACK` — опциональный

Текущие дефолты:
- primary: `openai/gpt-oss-20b:free`
- fallback: `google/gemma-3-12b-it:free`

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
- `title` должен быть непустой строкой
- `body` должен попадать в диапазон слов с допуском примерно `±20%`
- `estimatedMinutes` в ответе приложения принудительно равен настройке пользователя
- `level` в ответе приложения принудительно равен уровню пользователя

## 6) Frontend service
Файл:
- `src/services/readingService.ts`

Поведение:
1. Берет `window.Telegram.WebApp.initData`.
2. Вызывает `supabase.functions.invoke("generate-reading-text", { body: { initData } })`.
3. Если ответ успешный, возвращает `ReadingText` с:
- `source: "ai"`
- `generation.provider`
- `generation.model`
- `generation.fallbackUsed`
4. Если AI-ветка упала, пишет warning в консоль и вызывает RPC
`get_random_reading_text`.
5. RPC fallback возвращает `ReadingText` с `source: "db_fallback"`.

## 7) Dev-индикатор источника
Файл:
- `src/screens/ReadingScreen.tsx`

В dev-режиме рядом с заголовком текста показывается:
- `AI · <model>` — если текст пришел из AI
- `DB` — если сработал fallback на базу

В production этот индикатор не показывается.

## 8) Ограничения и будущие улучшения
Текущие ограничения:
- RPC fallback пока не учитывает `daily_reading_minutes`.
- Генерация длинных текстов зависит от доступности free-моделей OpenRouter.
- Валидация длины работает по простому подсчету слов через whitespace.
- Лимит генераций в UI сейчас отображается статически и не списывается на сервере.

Возможные следующие шаги:
- добавить серверный учет дневного лимита генераций
- сохранять сгенерированные тексты и metadata генерации в БД
- сделать fallback-тексты в БД разной длины под `daily_reading_minutes`
- добавить retry только для ошибок длины, чтобы модель могла перегенерировать текст
- вынести общую Telegram initData validation из Edge Functions в общий модуль, если функций станет больше
