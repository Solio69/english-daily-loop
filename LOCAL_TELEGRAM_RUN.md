# Локальный запуск Telegram Mini App (для команды)

Этот документ для разработчиков проекта `english-daily-loop`.
Цель: быстро поднять приложение локально, открыть его внутри Telegram и видеть runtime-логи в одном терминале.

Для локальной разработки без Telegram есть отдельный browser-режим. Он описан ниже и нужен
только для проверки dev-сценариев.

## 1. Что нужно один раз подготовить

1. Установить зависимости проекта:
   Команда: `pnpm install`  
   Зачем: ставит Node-зависимости, включая локальный `supabase` CLI.

2. Убедиться, что Docker Desktop запущен:
   Зачем: локальный Supabase работает через Docker-контейнеры.

3. Создать Telegram-бота через `@BotFather` и получить `TELEGRAM_BOT_TOKEN`:
   Зачем: сервер проверяет подпись `initData` от Telegram, без токена auth не пройдет.

4. Подготовить `cloudflared` в папке `tools/`:
   Windows пример:
   `Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile .\tools\cloudflared.exe`  
   Зачем: Telegram открывает Mini App только по публичному HTTPS URL, tunnel дает такой URL для локалки.

## 2. Проверить `.env.local`

Минимально должны быть переменные:

- `TELEGRAM_BOT_TOKEN`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_DEV_AUTH_FALLBACK="false"` (для реальной Telegram-авторизации)
- `VITE_SUPABASE_URL` (будет автоматически обновляться скриптом `dev:telegram`)

Важно: не коммитить `.env.local` в git.

## 3. Ежедневный запуск (основной сценарий)

1. Запустить всё одной командой:
   `npm run dev:telegram`

2. Дождаться блоков в терминале:

- `FRONTEND TUNNEL URL`
- `SUPABASE API TUNNEL URL`
- `STARTUP SUMMARY`

3. Обновить URL у `@BotFather`:

- Команда в Telegram: `/setmenubutton`
- Выбрать бота: `@english_daily_loop_bot`
- Вставить URL из `FRONTEND TUNNEL URL`

4. Открыть бота в Telegram на телефоне и нажать кнопку меню.

5. Смотреть логи в этом же терминале:

- `[frontend]` — Vite (клиент)
- `[auth]` — Edge Function `auth-telegram`
- `[api]` — Supabase API (Kong)
- `[db]` — Postgres
- `[tunnel-frontend]`, `[tunnel-api]` — cloudflared

## 4. Что делает `dev:telegram` под капотом

Скрипт `scripts/dev-stack.mjs` в Telegram mode:

1. Поднимает локальный Supabase (`npx supabase start`)
2. Запускает фронт (`pnpm dev`)
3. Запускает Edge Functions (`npx supabase functions serve ...`)
4. Поднимает 2 HTTPS tunnel:
   - frontend: `localhost:3000`
   - API: `localhost:55421`
5. Автоматически обновляет `VITE_SUPABASE_URL` в `.env.local` значением API tunnel URL
6. Печатает `STARTUP SUMMARY` с короткой инструкцией

## 4.1 Browser-режим для локальных сценариев

Browser-режим нужен только для разработки и проверки заранее подготовленных состояний.
В production приложение работает внутри Telegram.

Пример запуска:

```bash
npm run dev:browser -- active-text
```

Что делает browser mode:

- поднимает локальный Supabase;
- запускает frontend и Edge Functions;
- не запускает tunnels;
- ставит `VITE_SUPABASE_URL="http://127.0.0.1:55421"`;
- включает `VITE_ENABLE_DEV_AUTH_FALLBACK="true"`;
- ставит `VITE_DEV_TELEGRAM_USER_ID` под выбранный сценарий.

Открывать:

```text
http://localhost:3000
```

Доступные сценарии:

- `fresh` — новый пользователь без настроек;
- `onboarded` — настройки сохранены, первый текст еще не прочитан;
- `active-text` — есть активный текст;
- `completed-today` — чтение сегодня уже завершено;
- `paid` — активная paid-подписка;
- `history` — есть история прочитанных текстов.

Если сценарий не указан, используется `fresh`.

Важно: browser mode не подменяет AI. Генерация текста использует реальный `OPENROUTER_API_KEY`
и текущий серверный flow.

Dev-сценарии хранятся в `supabase/seed.sql`. Чтобы применить seed-сценарии в локальной БД,
используется полный reset:

```bash
npx supabase db reset
```

Эта команда пересоздает локальную БД и удаляет текущие локальные данные. Для применения только
новых миграций без пересоздания БД используется:

```bash
npx supabase migration up
```

## 5. Где смотреть, прошла ли Telegram-авторизация

Успешный путь обычно выглядит так:

1. В `[auth]` есть `incoming request` с `hasInitData: true`
2. В `[auth]` есть `initData validated`
3. В `[auth]` есть `existing user found` или `user created`
4. В `[api]` для `POST /functions/v1/auth-telegram` статус `200`

Если `initData` отсутствует, это обычно значит:

- приложение открыли не внутри Telegram WebApp, или
- у бота стоит старый menu button URL.

## 6. Частые проблемы и решения

1. Пустая страница или не тот frontend URL  
Причина: уже запущен другой Vite на `3000`, новый ушел на `3001`, а tunnel смотрит на `3000`.  
Что делать: остановить лишние dev-процессы и запустить `npm run dev:telegram` заново.

2. `503 BOOT_ERROR / Worker failed to boot` в `auth-telegram`  
Причина: ошибка в Deno-конфиге/функции (часто битый `deno.json`, BOM, синтаксис).  
Что делать: проверить `supabase/functions/deno.json` и логи `[auth]`.

3. `failed to parse environment file: .env.local (unexpected character '»')`  
Причина: неправильная кодировка `.env.local` (BOM/мусорный символ в начале).  
Что делать: пересохранить файл как `UTF-8` без BOM и перезапустить.

4. Открывается Dev-пользователь вместо Telegram-пользователя  
Причина: включен fallback или нет `initData`.  
Что делать: убедиться, что `VITE_ENABLE_DEV_AUTH_FALLBACK="false"` и запуск идет из Telegram.

5. Tunnel URL не работает  
Причина: Quick tunnel временный и может умереть.  
Что делать: перезапустить `npm run dev:telegram`, взять новые URL и снова обновить `/setmenubutton`.

## 7. Остановка

1. Остановить foreground-процессы: `Ctrl + C` в терминале `dev:telegram`
2. Остановить Supabase контейнеры:
   `npm run dev:stop`

## 8. Важно по безопасности

- Никогда не отправлять в чат и не коммитить:
  - `TELEGRAM_BOT_TOKEN`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - любые секреты из `.env.local`
- Все проверки `initData` делать только на сервере (Edge Function), не в клиенте.
