# Локальный запуск Telegram Mini App

Документ для разработчиков проекта `english-daily-loop`.

Цель: быстро поднять приложение локально, открыть его внутри Telegram и видеть runtime-логи в одном терминале.

## 1. Что нужно подготовить один раз

1. Установить зависимости проекта:
   `pnpm install`

   Зачем: ставит Node-зависимости, включая локальный `supabase` CLI.

2. Убедиться, что Docker Desktop запущен.

   Зачем: локальный Supabase работает через Docker-контейнеры.

3. Создать отдельного development-бота через `@BotFather` и получить его username и `TELEGRAM_BOT_TOKEN`.

   Зачем: сервер проверяет подпись `initData` от Telegram, без токена auth не пройдет. Production-бот остается постоянно привязан к Vercel и не используется для локальной разработки.

4. Подготовить `cloudflared` в папке `tools/`.

   Windows пример:

   ```powershell
   Invoke-WebRequest https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe -OutFile .\tools\cloudflared.exe
   ```

   Зачем: Telegram открывает Mini App только по публичному HTTPS URL, tunnel дает такой URL для локалки.

## 2. Подготовить `.env.telegram.local`

Скопировать `.env.telegram.example` в gitignored `.env.telegram.local` и заполнить development credentials.

Минимально должны быть переменные:

- `TELEGRAM_DEV_MODE="true"`
- `DEV_TELEGRAM_BOT_USERNAME` с username отдельного dev-бота
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_WEBHOOK_SECRET` — отдельное случайное значение длиной 32–256 символов из `A-Z`, `a-z`, `0-9`, `_`, `-`
- `OPENROUTER_API_KEY`
- `VITE_FEEDBACK_TELEGRAM_USERNAME`, если нужна ссылка обратной связи в настройках
- `DEV_TOOLS_ENABLED`, если нужны dev tools действия для admin-пользователя
- `SUBSCRIPTION_FLOW_ENABLED="false"`, пока пользовательский flow подписки выключен

`VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` заполняются скриптом значениями локального Supabase и tunnel. Команда не читает и не изменяет `.env.local` или secrets из Vercel/Supabase Cloud.

Важно: не коммитить `.env.telegram.local` в git и не использовать в нем production bot token.

## 3. Ежедневный запуск

1. Запустить все одной командой:

   ```bash
   npm run dev:telegram
   ```

2. Дождаться блоков в терминале:

- `FRONTEND TUNNEL URL`
- `SUPABASE API TUNNEL URL`
- `STARTUP SUMMARY`

3. Проверить в `STARTUP SUMMARY`, что dev-бот, menu button, Mini App URL и webhook URL настроены автоматически. В summary не должно быть token или webhook secret.

4. Открыть бота в Telegram, отправить `/start` и нажать inline button либо нижнюю menu button `Открыть приложение`.

5. Смотреть логи в этом же терминале:

- `[frontend]` — Vite preview со свежей production-like сборкой из `dist-telegram`
- `[frontend-watch]` — автоматическая пересборка `dist-telegram` после изменений frontend-кода
- `[edge]` — Supabase Edge Functions
- `[api]` — Supabase API
- `[db]` — Postgres
- `[tunnel-frontend]`, `[tunnel-api]` — Cloudflare tunnels

## 4. Что делает `dev:telegram`

Скрипт `scripts/dev-stack.mjs`:

1. Поднимает локальный Supabase (`npx supabase start`).
2. Получает локальный anon key из `npx supabase status -o env`.
3. Запускает Edge Functions с `--env-file .env.telegram.local`.
4. Поднимает HTTPS Quick Tunnel для Supabase API (`127.0.0.1:54321`) и ждёт появления URL в выводе `cloudflared`.
5. После получения URL обновляет `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` только в `.env.telegram.local`.
6. Собирает frontend (`pnpm build:telegram`) с env, переданным скриптом, в отдельную папку `dist-telegram`; Vite не загружает обычные env-файлы для mode `telegram-dev`.
7. Запускает frontend через Vite preview (`pnpm preview:telegram`) в mode `telegram-dev` на `localhost:3000` и обслуживает `dist-telegram`.
8. Запускает `pnpm watch:telegram` с тем же изолированным env; watcher автоматически пересобирает `dist-telegram` при изменении frontend-кода.
9. Поднимает HTTPS Quick Tunnel для frontend (`localhost:3000`) и ждёт появления URL в выводе `cloudflared`.
10. Проверяет username dev-бота через `getMe`, применяет display name `DEV: English Daily Loop`, остальной profile, `/start`/`/help`, default menu button и webhook на текущие tunnel URL; pending dev updates при новой регистрации очищаются.
11. Печатает `STARTUP SUMMARY` только после успешной настройки бота.
12. Подключает live-логи DB/API только с момента запуска stream (`docker logs --tail 0 --follow`), чтобы старая история контейнеров не скрывала summary.

Обычный `pnpm build` использует только `dist`, поэтому production-проверка не
перезаписывает bundle уже запущенного Telegram dev-preview. После изменения
frontend-кода дождись успешного сообщения `[frontend-watch]` и обнови либо
повторно открой Mini App. Tunnel, Telegram bot configuration и весь `dev:telegram`
перезапускать не нужно.

Watcher пересобирает production-like bundle, но не использует HMR: состояние
открытой страницы не заменяется автоматически. Не запускай
`pnpm build:telegram` вручную во время активного dev-stack — изолированный
Telegram-env передает именно оркестратор. Полный перезапуск требуется после
изменения `.env.telegram.local`, `vite.config.ts`, package dependencies или
обязательного процесса инфраструктуры.

### Локальные migrations и перезапуск

Новые migrations без пересоздания локальной БД применяются владельцем проекта:

```powershell
pnpm exec supabase migration up
```

Команда применяет только еще не примененные migrations и не удаляет локальные
данные. После изменения только SQL migration работающий `dev:telegram`
перезапускать не нужно: обновленный DB/RPC contract становится доступен текущему
локальному стеку.

Если scope добавляет новую Edge Function, ее обязательно нужно одновременно
добавить в `edgeFunctionNames` файла `scripts/dev/config.mjs`. Уже запущенный
function runner получил список функций в аргументах процесса и новую функцию не
подхватит, поэтому после такого изменения требуется один полный перезапуск
`npm run dev:telegram`. Изменения кода уже включенной Edge Function function
runner подхватывает без полного перезапуска.

Frontend preview, frontend watcher, Edge Functions и оба tunnel являются обязательными процессами. Если один из них неожиданно завершается, команда останавливает весь локальный стек с ошибкой. Потоки DB/API-логов вспомогательные: их завершение только фиксируется в терминале.

Локально поднимаются Edge Functions:

- `approve-vocabulary-card`
- `approve-vocabulary-cards`
- `auth-telegram`
- `save-user-settings`
- `activate-subscription`
- `complete-reading-text`
- `delete-pending-vocabulary-word`
- `dev-tools`
- `get-reading-state`
- `get-reading-history`
- `get-vocabulary-review-state`
- `get-vocabulary-state`
- `get-vocabulary-words`
- `generate-reading-text`
- `prepare-vocabulary-cards`
- `review-vocabulary-word`
- `save-reading-position`
- `save-vocabulary-word`
- `submit-support-report`
- `telegram-bot-webhook`

Локальные tunnel targets:

- frontend: `127.0.0.1:3000`
- API: `127.0.0.1:54321`

`dev:telegram` специально использует `127.0.0.1` для tunnel origins вместо `localhost`: на Windows `localhost` может резолвиться в IPv6 `::1`, пока Supabase local слушает IPv4. Если в логах Cloudflared есть `dial tcp [::1]`, значит tunnel target снова указывает на `localhost`.

Перед созданием туннелей скрипт проверяет локальные origins. Каждый Quick Tunnel URL создается один раз и остается активным до остановки команды. Скрипт не использует Node DNS readiness-check: на Windows системный `getaddrinfo` может сохранять отрицательный DNS-результат после того, как публичная запись уже появилась. Если Telegram открыл новый URL раньше публикации DNS, нужно повторно открыть Mini App через несколько секунд, не перезапуская команду.

После автоматической настройки Telegram Desktop может некоторое время показывать предыдущий текст menu button из клиентского кеша. Это не означает, что настройка не сохранилась. Нужно оставить текущий dev-stack запущенным и дождаться обновления кнопки; повторный запуск создаёт новые Quick Tunnel URL и повышает риск Cloudflare `429 Too Many Requests`.

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

3. `failed to parse environment file: .env.telegram.local`

   Причина: неправильная кодировка `.env.telegram.local` или мусорный символ в начале файла.

   Что делать: пересохранить файл как `UTF-8` без BOM и перезапустить.

4. Tunnel URL не работает

   Причина: Quick Tunnel временный и может завершиться уже после публикации URL.

   Что делать: перезапустить `npm run dev:telegram` и дождаться успешной автоматической настройки нового frontend URL и webhook. Если новый URL сразу не открылся, повторить открытие через несколько секунд, сохраняя текущий dev-stack запущенным; затем отправить новый `/start`.

## 7. Остановка

1. Остановить foreground-процессы: `Ctrl + C` в терминале `dev:telegram`.
2. Остановить Supabase-контейнеры:

   ```bash
   npm run dev:stop
   ```

Для проверки rollback чат-ответчика отдельного dev-бота удалить webhook можно командой:

```bash
pnpm telegram:dev:webhook:delete
```

Команда проверяет dev username через `getMe`, очищает pending dev updates и не меняет menu button. Следующий `npm run dev:telegram` автоматически восстановит webhook на новые tunnel URL.

## 8. Важно по безопасности

- Никогда не отправлять в чат и не коммитить:
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_BOT_WEBHOOK_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENROUTER_API_KEY`
  - любые секреты из `.env.telegram.local` и других локальных env-файлов
- Не менять menu button production-бота `@english_daily_loop_bot` на временный tunnel URL; dev launcher проверяет отдельный username до Bot API mutations.
- Все проверки `initData` делать только на сервере в Edge Functions, не в клиенте.
- Публичный `telegram-bot-webhook` не использует `initData`: Telegram аутентифицирует его отдельным secret header; функция не обращается к БД.
- Локальная dev tools панель отображается только для `admin`, а действия с БД разрешает только server env `DEV_TOOLS_ENABLED` вместе с server-side проверкой `users.app_role = 'admin'`.
- Отчеты об ошибках отправляются через `submit-support-report` и сохраняются в `public.support_reports`; применение только связанной SQL migration не требует перезапуска `dev:telegram`.
