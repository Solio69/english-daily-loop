# Security audit notes - 2026-04-30

## Scope
Проверены базовые слои безопасности MVP:
- секреты и frontend env
- клиентский сервисный слой
- Edge Functions auth и input validation
- бизнес-правила лимитов, подписок и чтения
- Postgres RLS, grants и RPC
- dev tools
- AI pipeline
- логи и ошибки

## Что проверено

### Секреты и frontend
- Во frontend используются только `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_DEV_TOOLS_ENABLED` и dev-only `VITE_DEBUG_AUTH`.
- `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` и `OPENROUTER_API_KEY`
  читаются только в Supabase Edge Functions через `Deno.env`.
- `.gitignore` закрывает `.env*`, кроме `.env.example`.

### Клиентский слой
- `src/services` вызывает backend через `supabase.functions.invoke(...)`.
- Прямых клиентских `insert/update/upsert/delete/rpc` в защищенные таблицы и RPC не найдено.
- Frontend отправляет `initData` и намерение пользователя, но не принимает
  server-side решения по лимитам, подпискам и текущему пользователю.

### Edge Functions
- Чувствительные функции валидируют Telegram `initData` на сервере.
- Пользователь находится по `telegram_user_id` из валидного `initData`, а не из body.
- Для `initData` проверяется `auth_date` с окном 24 часа.
- Входные параметры проходят allowlist/range validation:
  - настройки пользователя
  - `planType`
  - `limit`
  - `cursor`
  - dev tools actions

### Business logic
- Дневной лимит генерации считается сервером.
- Генерация после дневного completion блокируется сервером.
- Списание попытки генерации атомарно вынесено в RPC.
- Завершение чтения атомарно вынесено в RPC.
- Активация подписки атомарно вынесена в RPC.
- История чтения фильтруется по текущему app user на сервере.

### Postgres
- RLS включен на пользовательских, reading-state, completion/history и subscription таблицах.
- Критичные RPC выданы только `service_role`.
- Добавлена hardening-миграция, которая явно отзывает прямой доступ `anon/authenticated`
  к защищенным таблицам и legacy RPC `get_random_reading_text`.

### Dev tools
- Frontend-флаг `VITE_DEV_TOOLS_ENABLED` только показывает UI.
- Реальное выполнение dev actions закрыто server env `DEV_TOOLS_ENABLED`.
- Dev actions фиксированы allowlist-ом и работают только с текущим Telegram-пользователем.

### AI pipeline
- `OPENROUTER_API_KEY` используется только server-side.
- В prompt не отправляются секреты, полный `initData` или лишние пользовательские данные.
- Есть timeout запроса к OpenRouter.
- Ответ модели валидируется как JSON с ожидаемыми полями и диапазоном слов.
- При ошибке генерации активный текст не перезаписывается.

## Внесенные изменения
- `notes/security-threat-model.md` - зафиксирована модель угроз MVP.
- `supabase/migrations/20260430120000_harden_public_api_permissions.sql` -
  добавлен DB hardening для public schema, защищенных таблиц и legacy RPC.
- Edge Functions теперь не возвращают raw `error.message` для неожиданных внутренних ошибок.
  Подробности остаются в server logs, клиент получает стабильное безопасное сообщение.
- `generate-reading-text` теперь возвращает `401 AUTH_VALIDATION_FAILED` для невалидного
  Telegram `initData`, как остальные чувствительные функции.

## Ручная проверка
- Локальный Telegram flow после security hardening проверен вручную.
- Авторизация через Telegram работает корректно.
- Генерация текста работает корректно.
- Завершение чтения работает корректно.
- История и материалы работают корректно.
- Регрессий после hardening не найдено.

## Остаточные риски
- Telegram validation и общие helpers продублированы между Edge Functions.
  Для production лучше вынести общий auth/error/env модуль.
- Нет отдельного технического rate limit на все Edge Functions.
  Бизнес-лимит генераций есть, но auth/history/settings/subscription можно дополнительно
  защищать на уровне platform/API gateway.
- CORS сейчас `*`. Это не является auth-защитой, но перед production можно сузить origin,
  если будет стабильный production domain.
- Нет автоматических security-тестов на прямые anon-запросы к таблицам/RPC.
  После применения миграции стоит добавить smoke-check SQL/API сценарии.
