# AGENTS.md

## Назначение
Этот файл фиксирует правила работы AI-агентов в репозитории, чтобы процесс был предсказуемым, безопасным и удобным для владельца проекта.

## Контекст проекта
- Проект: `english-daily-loop`.
- Текущий стек: Vite + React + TypeScript.
- Пакетный менеджер: `pnpm`.
- Целевой продукт: Telegram Mini App.
- Вектор по данным: Supabase (Postgres).
- Локальная инфраструктура уже настроена: Docker + WSL + Supabase local.
- Единый запуск локальной инфраструктуры: `npm run dev:all` (frontend + Supabase + Edge Functions + Cloudflare tunnels + логи DB/API + startup summary + автообновление `VITE_SUPABASE_URL` в `.env.local`).
- Отдельного backend-сервера (Express) сейчас нет; backend-слой представлен Supabase API + Edge Functions.
- Папка `tools/` используется для локальных утилит запуска (например, `cloudflared.exe`) и не коммитится.

## Правила коммуникации
- По умолчанию объяснять на русском языке.
- Каждую команду объяснять перед запуском: что она делает и зачем.
- В режимах настройки и отладки с пользователем давать по одной команде за шаг.
- После шага ждать вывод/скриншот пользователя и только потом двигаться дальше.
- Тон: поддерживающий, без оценочности и давления.
- Предпочитать короткие и практичные инструкции вместо длинной теории.

## Правила принятия решений
- Не спешить с реализацией, пока архитектурный выбор не согласован.
- Для решений с компромиссами (стоимость, безопасность, lock-in) кратко показывать варианты.
- Предпочитать маленькие итеративные изменения вместо крупных рефакторингов.
- Перед изменениями с неочевидными последствиями явно подтверждать направление.

## Технический вектор (по умолчанию)
- Для MVP сначала использовать Supabase.
- Изолировать доступ к данным в сервисном слое, чтобы позже можно было перейти на обычный Postgres.
- Не смешивать бизнес-логику и UI-компоненты без необходимости.
- Общие доменные типы держать в `src/types`.

## Ограничения Telegram Mini App
- Использовать `telegram_user_id` как стабильный идентификатор пользователя.
- Проверку `Telegram initData` выполнять только на серверной стороне.
- Не хранить и не использовать чувствительные ключи в клиентском коде.

## Правила безопасности
- Никогда не коммитить реальные ключи, токены и секреты.
- Секреты хранить в `.env.local`, а требования документировать в `.env.example`.
- `SUPABASE_SERVICE_ROLE_KEY` использовать только на сервере.
- `OPENROUTER_API_KEY` использовать только на сервере, через Supabase Edge Functions.
- Не ослаблять контроль доступа ради скорости разработки.

## Правила внесения изменений
- Сохранять текущую структуру и стиль проекта, если явный рефакторинг не запрошен.
- Делать небольшие, проверяемые изменения.
- Не использовать разрушительные git/file операции без явного запроса.
- После существенных изменений запускать проверки (минимум `pnpm lint`) и сообщать результат.

## Жесткая Git-политика
- Агенту запрещены любые команды, меняющие историю или состояние репозитория: `git commit`, `git push`, `git merge`, `git rebase`, `git cherry-pick`, `git reset`, `git revert`, `git tag`, `git stash`, `git checkout` (для переключения/отката), `git switch`, `git restore`, `git clean`.
- Агент может использовать Git только в режиме чтения: `git status`, `git log`, `git diff`, `git show`, `git blame`, `git branch --show-current`, `git rev-parse`.
- Это строгое правило без исключений, пока пользователь явно не изменит политику в репозитории.
- Детальная формулировка вынесена в отдельный файл: `GIT_POLICY.md`.

## Текущий статус (для будущих агентов)
- Supabase local и Docker-окружение уже работают.
- Уже подключены и используются таблицы `public.users`, `public.user_settings` и `public.reading_texts`.
- В `public.user_settings` есть настройки `english_level`, `daily_exercise_minutes`, `daily_reading_minutes`, `daily_review_words`.
- В проекте есть базовые миграции и сиды для локальной разработки (dev user + моковые тексты).
- Корневой `tsconfig.json` исключает `supabase/functions`, потому что Edge Functions работают в Deno-рантайме и не должны проверяться frontend `tsc`.
- Telegram auth реализована через Edge Function `supabase/functions/auth-telegram/index.ts`:
  - серверная валидация `initData` (подпись + `auth_date`)
  - `find-or-create` пользователя по `telegram_user_id`
  - единый контракт ответа (`ok/data` или `ok/error`).
- Генерация текста реализована через Edge Function `supabase/functions/generate-reading-text/index.ts`:
  - серверная валидация `Telegram initData`
  - поиск пользователя по `telegram_user_id`
  - чтение `english_level` и `daily_reading_minutes` из `user_settings`
  - генерация через OpenRouter primary/fallback модели
  - динамический `max_tokens` и диапазон слов по времени чтения
  - валидация длины с допуском примерно `±20%`
  - единый контракт ответа (`ok/data` или `ok/error`).
- Текущие дефолтные OpenRouter-модели:
  - primary: `openai/gpt-oss-20b:free`
  - fallback: `google/gemma-3-12b-it:free`.
- Требуемые server env для AI:
  - `OPENROUTER_API_KEY`
  - опционально `OPENROUTER_MODEL_PRIMARY`
  - опционально `OPENROUTER_MODEL_FALLBACK`.
- Для стабильной DX в редакторе: у функции используется `// @ts-nocheck`, а для Deno-окружения есть `supabase/functions/deno.json` и `supabase/functions/deno-globals.d.ts`.
- На фронте подключен Telegram WebApp SDK (`index.html`) и типы `window.Telegram.WebApp` (`src/types/telegram-webapp.d.ts`).
- Bootstrap пользователя в `src/services/userService.ts` сначала пытается авторизоваться через `auth-telegram`; dev fallback управляется env-переменной `VITE_ENABLE_DEV_AUTH_FALLBACK`.
- Логика чтения вынесена в сервисный слой (`src/services/readingService.ts`), UI-компонент не содержит прямых запросов к БД.
- `readingService` сначала вызывает `generate-reading-text`, а при ошибке делает UX fallback на RPC `get_random_reading_text`.
- В dev-режиме экран чтения показывает источник текста (`AI` + модель или `DB`) через metadata `ReadingText.source/generation`.
- Настройка времени чтения влияет на размер AI-текста:
  - `3` мин: `120-180` слов, `max_tokens: 450`
  - `5` мин: `220-320` слов, `max_tokens: 750`
  - `10` мин: `450-650` слов, `max_tokens: 1300`
  - `15` мин: `700-950` слов, `max_tokens: 1900`.
- При bootstrap настройки пользователя должны приходить с backend, если `settings_completed_at` уже заполнен.
- В состоянии "настройки сохранены, но первый текст еще не прочитан" разделы `Упражнения` и `Слова` заблокированы, но `Главная` и `Текст` доступны.
- `vite.config.ts` разрешает внешние tunnel host'ы (`.trycloudflare.com`, `.loca.lt`) для запуска Mini App через Telegram.
- `npm run dev:all` автоматически поднимает frontend/API туннели и печатает `STARTUP SUMMARY` с двумя URL:
  - `BotFather /setmenubutton URL` = FRONTEND TUNNEL URL
  - `.env.local VITE_SUPABASE_URL` = SUPABASE API TUNNEL URL.
- `npm run dev:all` поднимает Edge Functions `auth-telegram` и `generate-reading-text`.
- Логи в `dev:all` цветные по источнику (`[frontend]`, `[edge]`, `[db]`, `[api]`, `[tunnel-*]`), HTTP-методы и статус-коды дополнительно подсвечиваются.
- Если в summary указано `Frontend restart required: YES`, нужно перезапустить `dev:all`.
- Для локального старта использовать `npm run dev:all`, для остановки Supabase: `npm run dev:stop`.

