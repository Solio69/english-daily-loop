# Локальный запуск Telegram Mini App

Документ для разработчиков проекта `english-daily-loop`.

Цель: быстро поднять приложение локально, открыть его внутри Telegram и видеть runtime-логи в одном терминале.

## 1. Что нужно подготовить один раз

1. Установить зависимости проекта:
   `pnpm install`

   Зачем: ставит Node-зависимости, включая локальный `supabase` CLI.

2. Убедиться, что Docker Desktop запущен.

   Зачем: локальный Supabase работает через Docker-контейнеры.

3. Создать Telegram-бота через `@BotFather` и получить `TELEGRAM_BOT_TOKEN`.

   Зачем: сервер проверяет подпись `initData` от Telegram, без токена auth не пройдет.

4. Подготовить `cloudflared` в папке `tools/`.

   Windows пример:

   ```powershell
   Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile .\tools\cloudflared.exe
   ```

   Зачем: Telegram открывает Mini App только по публичному HTTPS URL, tunnel дает такой URL для локалки.

## 2. Проверить `.env.local`

Минимально должны быть переменные:

- `TELEGRAM_BOT_TOKEN`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL` (будет автоматически обновляться скриптом `dev:telegram`)
- `OPENROUTER_API_KEY`
- `VITE_FEEDBACK_TELEGRAM_USERNAME`, если нужна ссылка обратной связи в настройках
- `DEV_TOOLS_ENABLED`, если нужны dev tools действия для admin-пользователя
- `SUBSCRIPTION_FLOW_ENABLED="false"`, пока пользовательский flow подписки выключен

Важно: не коммитить `.env.local` в git.

## 3. Ежедневный запуск

1. Запустить все одной командой:

   ```bash
   npm run dev:telegram
   ```

2. Дождаться блоков в терминале:

- `FRONTEND TUNNEL URL`
- `SUPABASE API TUNNEL URL`
- `STARTUP SUMMARY`

3. Обновить URL у `@BotFather`:

- команда в Telegram: `/setmenubutton`
- выбрать бота: `@english_daily_loop_bot`
- вставить URL из `FRONTEND TUNNEL URL`

4. Открыть бота в Telegram на телефоне и нажать кнопку меню.

5. Смотреть логи в этом же терминале:

- `[frontend]` — Vite preview со свежей production-like сборкой
- `[edge]` — Supabase Edge Functions
- `[api]` — Supabase API
- `[db]` — Postgres
- `[tunnel-frontend]`, `[tunnel-api]` — Cloudflare tunnels

## 4. Что делает `dev:telegram`

Скрипт `scripts/dev-stack.mjs`:

1. Поднимает локальный Supabase (`npx supabase start`).
2. Запускает Edge Functions (`npx supabase functions serve ...`).
3. Поднимает HTTPS tunnel для Supabase API (`127.0.0.1:54321`).
4. Автоматически обновляет `VITE_SUPABASE_URL` в `.env.local` значением API tunnel URL.
5. Собирает frontend (`pnpm build`).
6. Запускает frontend через Vite preview (`pnpm preview:telegram`) на `localhost:3000`.
7. Поднимает HTTPS tunnel для frontend (`localhost:3000`).
8. Печатает `STARTUP SUMMARY` с короткой инструкцией.

Локально поднимаются Edge Functions:

- `approve-vocabulary-card`
- `approve-vocabulary-cards`
- `auth-telegram`
- `save-user-settings`
- `activate-subscription`
- `complete-reading-text`
- `dev-tools`
- `get-reading-state`
- `get-reading-history`
- `get-vocabulary-review-state`
- `get-vocabulary-state`
- `get-vocabulary-words`
- `generate-reading-text`
- `prepare-vocabulary-cards`
- `review-vocabulary-word`
- `save-vocabulary-word`
- `submit-support-report`

Локальные tunnel targets:

- frontend: `127.0.0.1:3000`
- API: `127.0.0.1:54321`

`dev:telegram` специально использует `127.0.0.1` для tunnel origins вместо `localhost`: на Windows `localhost` может резолвиться в IPv6 `::1`, пока Supabase local слушает IPv4. Если в логах Cloudflared есть `dial tcp [::1]`, значит tunnel target снова указывает на `localhost`.

Перед печатью tunnel URL скрипт проверяет, что локальные API и frontend origins отвечают. Это защищает от обновления `.env.local` и BotFather публичным URL, который не достает до локального сервиса.

Frontend собирается после получения API tunnel URL, чтобы production-like bundle использовал актуальный публичный адрес Supabase API.

Локальная панель dev tools видна текущему Telegram-пользователю с ролью `admin`.
Действия, которые меняют БД, выполняются только при включенной server env:

```env
DEV_TOOLS_ENABLED="true"
```

`DEV_TOOLS_ENABLED` разрешает Edge Function менять локальную БД, а server-side проверка `users.app_role = 'admin'` защищает actions от прямого вызова.

Чтобы сделать текущего пользователя админом в локальной БД после применения миграций, выполни SQL в Supabase Studio:

```sql
update public.users
set app_role = 'admin'
where telegram_user_id = YOUR_TELEGRAM_USER_ID;
```

В интерфейсе dev tools панель свернута по умолчанию: раскрой заголовок `Dev tools`, чтобы увидеть локальные действия.

Доступные dev tools действия:

- `Сброс текстов` обнуляет попытки генерации текстов за сегодня.
- `Сброс AI-карточек` обнуляет попытки подготовки карточек словаря за сегодня.
- `Сброс повторения` возвращает все ready-карточки текущего пользователя в начало алгоритма и очищает статистику повторения.
- `Слова на сегодня` назначает активным ready-карточкам текущую московскую дату повторения.
- `Повторить все слова` переносит обязательную очередь текущего дня на выбранный абсолютный шаг и закрывает completion-marker повторения.
- `Открыть повторение` удаляет completion-marker повторения за текущую московскую дату.
- `Удалить прочитанное` удаляет progress-marker текущего дня и все завершенные сегодня тексты текущего Telegram-пользователя из истории.
- `Сброс подписок` удаляет MVP-подписки текущего Telegram-пользователя.

## 5. Как понять, что Telegram-авторизация прошла

Успешный путь обычно выглядит так:

1. В `[edge]` есть `incoming request` с `hasInitData: true`.
2. В `[edge]` есть `initData validated`.
3. В `[edge]` есть `existing user found` или `user created`.
4. В `[api]` для `POST /functions/v1/auth-telegram` статус `200`.

Если `initData` отсутствует, обычно это значит:

- приложение открыли не внутри Telegram WebApp; или
- у бота стоит старый menu button URL.

## 6. Частые проблемы и решения

1. Пустая страница или не тот frontend URL

   Причина: уже запущен другой frontend-процесс на `3000`, а tunnel смотрит на этот порт.

   Что делать: остановить лишние dev-процессы и запустить `npm run dev:telegram` заново.

2. `503 BOOT_ERROR / Worker failed to boot` в Edge Function

   Причина: ошибка в Deno-конфиге или коде функции.

   Что делать: проверить `supabase/functions/deno.json` и логи `[edge]`.

3. `failed to parse environment file: .env.local`

   Причина: неправильная кодировка `.env.local` или мусорный символ в начале файла.

   Что делать: пересохранить файл как `UTF-8` без BOM и перезапустить.

4. Tunnel URL не работает

   Причина: quick tunnel временный и может умереть.

   Что делать: перезапустить `npm run dev:telegram`, взять новые URL и снова обновить `/setmenubutton`.

## 7. Остановка

1. Остановить foreground-процессы: `Ctrl + C` в терминале `dev:telegram`.
2. Остановить Supabase-контейнеры:

   ```bash
   npm run dev:stop
   ```

## 8. Важно по безопасности

- Никогда не отправлять в чат и не коммитить:
  - `TELEGRAM_BOT_TOKEN`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENROUTER_API_KEY`
  - любые секреты из `.env.local`
- Все проверки `initData` делать только на сервере в Edge Functions, не в клиенте.
- Локальная dev tools панель отображается только для `admin`, а действия с БД разрешает только server env `DEV_TOOLS_ENABLED` вместе с server-side проверкой `users.app_role = 'admin'`.
- Отчеты об ошибках отправляются через `submit-support-report` и сохраняются в `public.support_reports`; для проверки этой функции после новой миграции нужен перезапуск `npm run dev:telegram`.
