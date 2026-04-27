# english-daily-loop

Telegram Mini App для ежедневной практики английского языка.

Проект сейчас находится в MVP-стадии. Основной фокус: короткий ежедневный цикл обучения,
генерация текста для чтения под уровень пользователя, дневной прогресс и простая модель
подписок.

## Что уже есть

- Telegram Mini App с авторизацией через `Telegram WebApp initData`.
- Онбординг с настройками уровня английского и времени занятий.
- Экран чтения с AI-генерацией текста через OpenRouter.
- Серверные дневные лимиты генерации текста.
- Активный непрочитанный текст на пользователя.
- Завершение дневного чтения и streak по дням.
- MVP-подписки: `free` и `paid` тарифное состояние без реальных платежей.
- Локальный запуск всего стека одной командой через `npm run dev:all`.

## Стек

- Vite
- React
- TypeScript
- pnpm
- Supabase local
- Supabase Edge Functions
- Postgres
- OpenRouter для AI-генерации текстов
- Cloudflare Tunnel для запуска Mini App внутри Telegram во время локальной разработки

## Архитектура

В проекте нет отдельного Express/Nest backend. Backend-слой сейчас состоит из Supabase API,
Postgres и Supabase Edge Functions.

Основная граница ответственности:

- `src/screens` — UI-экраны приложения.
- `src/services` — клиентский сервисный слой, который вызывает Supabase и Edge Functions.
- `src/types` — общие frontend/domain типы.
- `supabase/migrations` — схема базы данных.
- `supabase/functions` — серверная логика, которая выполняется в Deno runtime.
- `notes` — проектные решения и текущие ограничения.
- `scripts/dev-all.mjs` — локальная инфраструктура разработки.
- `tools` — локальные утилиты вроде `cloudflared.exe`; папка не коммитится.

Важный принцип: фронт не принимает security/business-решения по лимитам, подписке и Telegram
auth. Он только отображает состояние, которое возвращает сервер.

## Edge Functions

Сейчас используются функции:

- `auth-telegram` — валидирует Telegram `initData`, создает или находит пользователя,
  возвращает настройки, подписку, прогресс главного экрана и streak.
- `activate-subscription` — активирует MVP-подписку за 0 рублей.
- `get-reading-state` — возвращает состояние экрана чтения: активный текст, лимиты,
  использованные попытки и факт завершения чтения за день.
- `generate-reading-text` — списывает попытку, вызывает OpenRouter, валидирует ответ модели
  и сохраняет активный текст.
- `complete-reading-text` — завершает дневное чтение, удаляет активный текст и обновляет streak.

Все чувствительные операции выполняются на сервере. `TELEGRAM_BOT_TOKEN`,
`SUPABASE_SERVICE_ROLE_KEY` и `OPENROUTER_API_KEY` нельзя использовать в клиентском коде.

## Данные

Ключевые таблицы:

- `public.users`
- `public.user_settings`
- `public.reading_texts`
- `public.reading_generation_attempts`
- `public.user_active_reading_texts`
- `public.user_daily_reading_completions`
- `public.user_subscriptions`

Дневной цикл считается по timezone `Europe/Moscow`.

Текущие MVP-лимиты:

- `free`: 3 генерации текста в день, словарь до 30 слов.
- `paid`: 10 генераций текста в день, словарь до 300 слов.

Подписки пока тестовые:

- `monthly` действует 1 день.
- `yearly` действует 7 дней.
- реальные платежи не подключены.

## Переменные окружения

Создай `.env.local` на основе `.env.example`.

Обязательные переменные:

```env
VITE_SUPABASE_URL="http://127.0.0.1:55421"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_ENABLE_DEV_AUTH_FALLBACK="true"
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
```

Опциональные переменные для выбора OpenRouter-моделей:

```env
OPENROUTER_MODEL_PRIMARY="openai/gpt-oss-20b:free"
OPENROUTER_MODEL_FALLBACK="google/gemma-3-12b-it:free"
OPENROUTER_MODEL_TERTIARY="qwen/qwen3.6-plus:free"
```

Правило безопасности: во frontend доступны только переменные с префиксом `VITE_`.
AI-ключи, Telegram token и service role key должны оставаться только на серверной стороне.

## Локальный запуск

Нужны:

- Node.js
- pnpm
- Docker Desktop
- локальная утилита `tools/cloudflared.exe` для Telegram Mini App запуска через HTTPS tunnel

Установить зависимости:

```bash
pnpm install
```

Запустить весь локальный стек:

```bash
npm run dev:all
```

`dev:all` делает следующее:

- запускает локальный Supabase;
- запускает Vite frontend на `localhost:3000`;
- запускает Edge Functions;
- поднимает tunnel для frontend;
- поднимает tunnel для Supabase API;
- автоматически обновляет `VITE_SUPABASE_URL` в `.env.local`;
- показывает логи frontend, Edge Functions, DB и API;
- печатает `STARTUP SUMMARY` с URL для BotFather.

Если в summary указано `Frontend restart required: YES`, останови процесс через `Ctrl + C`
и запусти `npm run dev:all` еще раз.

Остановить локальный Supabase:

```bash
npm run dev:stop
```

## Запуск внутри Telegram

После `npm run dev:all` дождись `STARTUP SUMMARY`.

В BotFather:

1. Выполни `/setmenubutton`.
2. Выбери нужного бота.
3. Вставь `BotFather /setmenubutton URL` из startup summary.
4. Открой бота в Telegram и нажми кнопку меню.

Для реальной Telegram-авторизации в `.env.local` нужно выключить browser fallback:

```env
VITE_ENABLE_DEV_AUTH_FALLBACK="false"
```

## Команды

```bash
pnpm dev
```

Запускает только frontend.

```bash
npm run dev:all
```

Запускает локальную инфраструктуру для Telegram Mini App.

```bash
npm run dev:stop
```

Останавливает локальный Supabase.

```bash
pnpm lint
```

Запускает TypeScript-проверку frontend-кода.

```bash
pnpm build
```

Собирает production build frontend-приложения.

## Разработка

- Новую работу с данными лучше выносить в `src/services`, а не напрямую в UI-компоненты.
- Общие типы держать в `src/types`.
- Серверные проверки Telegram `initData`, лимитов и подписок должны оставаться в Edge Functions.
- Edge Functions работают в Deno runtime и исключены из корневого frontend `tsconfig.json`.
- После изменения Edge Functions или server env нужно перезапустить `npm run dev:all`.
- После существенных изменений стоит запускать минимум `pnpm lint`.

## Документация проекта

Дополнительный контекст лежит в:

- `AGENTS.md` — правила работы в репозитории и текущий статус.
- `GIT_POLICY.md` — строгая политика Git для AI-агентов.
- `LOCAL_TELEGRAM_RUN.md` — подробный локальный запуск внутри Telegram.
- `notes/text-generation-pipeline.md` — AI-пайплайн генерации текста.
- `notes/reading-generation-limits.md` — дневные попытки и активный текст.
- `notes/subscriptions.md` — MVP-модель подписок.
- `notes/home-progress-and-toast.md` — прогресс главного экрана и toast-сообщения.
- `notes/production-readiness.md` — что нужно пересмотреть перед production.
