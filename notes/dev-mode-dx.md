# Режим разработки / DX

## 1) Назначение
Документ фиксирует текущий локальный режим разработки приложения.

Приложение является Telegram Mini App, поэтому основной и единственный dev-запуск для проверки пользовательского flow идет внутри Telegram.

## 2) Локальный Telegram-режим

Команда:

```bash
npm run dev:telegram
```

Что делает:

- запускает локальный Supabase;
- запускает Supabase Edge Functions;
- запускает Cloudflare Quick Tunnel для Supabase API и ждёт появления URL в выводе `cloudflared`;
- после получения URL обновляет `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в `.env.telegram.local` значениями API tunnel и локального Supabase;
- собирает frontend через `pnpm build:telegram` в изолированном Vite-режиме `telegram-dev`;
- запускает frontend через Vite preview на `127.0.0.1:3000`;
- запускает Cloudflare Quick Tunnel для frontend и ждёт появления URL в выводе `cloudflared`;
- печатает URL для BotFather и startup summary после получения обоих публичных адресов.

Этот режим использует настоящий Telegram `initData` и реального Telegram-пользователя. Это ближе к production-поведению и не смешивает разработку с браузерными dev-пользователями.

Telegram Desktop может обновлять menu button с задержкой после успешного ответа BotFather. Текущий dev-stack нужно оставить запущенным и дождаться обновления кнопки: повторный запуск создаёт новые Quick Tunnel URL и может попасть под Cloudflare rate limit.

Frontend, Edge Functions и tunnels обязательны для рабочего Telegram-режима, поэтому завершение любого из этих процессов останавливает весь dev-stack. DB/API log-stream остаются вспомогательными.

Frontend собирается после получения API tunnel URL. После изменений frontend-кода, Edge Functions или server env локальный Telegram-режим нужно перезапустить.

## 3) Данные и сценарии

Локальный seed содержит базового dev-пользователя и моковые тексты. Переключение пользовательских сценариев через подмену Telegram-пользователя не используется.

Для проверки состояний одного Telegram-пользователя используется панель dev tools. Она доступна только пользователю с `users.app_role = 'admin'`, вызывает Edge Function `dev-tools` и меняет состояние текущего пользователя в БД без `supabase db reset`.
В интерфейсе панель свернута по умолчанию и раскрывается по заголовку `Dev tools`.

Доступные сценарии словаря и повторения:

- сброс дневных попыток подготовки AI-карточек;
- возврат ready-карточек в `not_started` с очисткой статистики;
- назначение активных карточек на текущую московскую дату;
- перенос обязательной очереди повторения текущего дня на выбранный абсолютный шаг;
- удаление completion-marker повторения за текущую дату.

Edge Function `dev-tools` возвращает безопасный summary `{ action, today, changes }`;
детали изменений используются только для локальной диагностики.

## 4) Когда нужен reset локальной БД

Полный reset локальной базы:

```bash
npx supabase db reset
```

`db reset` пересоздает локальную БД, заново применяет миграции и выполняет `supabase/seed.sql`. Текущие локальные данные при этом удаляются.

Новые миграции без пересоздания локальной БД применяются отдельно:

```bash
npx supabase migration up
```

## 5) Правила безопасности

- Telegram `initData` проверяется только на сервере в Edge Functions.
- development-секреты `TELEGRAM_BOT_TOKEN` и `OPENROUTER_API_KEY` хранятся только в gitignored `.env.telegram.local`, а локальный `SUPABASE_SERVICE_ROLE_KEY` берется из Supabase local; эти значения не попадают во frontend-код или git.
- Локальный Telegram-режим не подменяет пользователя и не обходит серверную авторизацию.
- Панель dev tools показывается только при роли `admin`.
- Edge Function `dev-tools` выполняет reset-действия только при server env `DEV_TOOLS_ENABLED="true"` и server-side проверке `users.app_role = 'admin'`.
- Доступные dev actions ограничены текущим Telegram-пользователем: попытки генерации, подготовка карточек, повторение слов, дневное чтение и MVP-подписки.
