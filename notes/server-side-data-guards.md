# Server-side data guards

## 1) Область документа
Документ фиксирует текущую модель защиты данных: какие операции выполняются только на сервере,
где включен RLS и какие бизнес-действия вынесены в Postgres RPC.

## 2) Основной принцип
Frontend получает состояние и отправляет пользовательские намерения, но не принимает
security/business-решения.

Клиент не должен напрямую:
- валидировать Telegram `initData`
- выбирать пользователя по `telegram_user_id`
- сохранять настройки в `public.users` или `public.user_settings`
- списывать попытки генерации
- завершать активный текст
- активировать подписки

Эти действия выполняются в Supabase Edge Functions с серверными секретами.

Общая server-инфраструктура Edge Functions находится в `supabase/functions/_shared/server.ts`.
Там живут CORS, POST guard, JSON parsing, env helpers, Telegram `initData` validation,
безопасные JSON-ответы и `AppError`. Бизнес-валидация остается в конкретных функциях:
лимиты, подписки, чтение, completion и AI-пайплайн проверяются рядом с соответствующей операцией.

## 3) RLS и grants
RLS включен для:
- `public.users`
- `public.user_settings`
- `public.reading_generation_attempts`
- `public.user_active_reading_texts`
- `public.user_daily_reading_completions`
- `public.user_completed_reading_texts`
- `public.user_subscriptions`

Миграции:
- `supabase/migrations/20260427165000_enable_rls_for_users_and_settings.sql`
- `supabase/migrations/20260423120000_add_reading_generation_limits.sql`
- `supabase/migrations/20260423133000_create_user_subscriptions.sql`
- `supabase/migrations/20260427181000_create_user_completed_reading_texts.sql`
- `supabase/migrations/20260430120000_harden_public_api_permissions.sql`

Frontend policies для защищенных таблиц не добавлены. Для `anon` и `authenticated`
явно закрыт прямой доступ к пользовательским, reading-state, completion/history и
subscription таблицам, а также к server-only RPC. Доступ идет через Edge Functions с
`SUPABASE_SERVICE_ROLE_KEY`. Это сохраняет простую MVP-модель: пользовательская сессия
подтверждается Telegram `initData`, а не Supabase Auth session.

## 4) Edge Functions
`auth-telegram`:
- валидирует Telegram `initData`
- создает или находит пользователя по `telegram_user_id`
- возвращает `settings`, `subscription`, `homeProgress` и `streakDays`
- разделяет ошибки Telegram validation и внутренние DB/server ошибки
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`save-user-settings`:
- валидирует Telegram `initData`
- проверяет значения настроек
- сохраняет `english_level`, `daily_reading_minutes`
- заполняет `users.settings_completed_at`, если настройки сохраняются впервые
- возвращает актуальное состояние пользователя для frontend
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`generate-reading-text`:
- валидирует Telegram `initData`
- проверяет настройки и подписку
- списывает попытку через RPC `claim_reading_generation_attempt`
- сохраняет активный AI-текст при успешной генерации
- возвращает клиенту безопасное сообщение для неожиданных AI/provider ошибок

`get-reading-state`:
- валидирует Telegram `initData`
- возвращает активный текст, дневной лимит, использованные/оставшиеся попытки и флаг завершения чтения за день
- считает дневной цикл по timezone `Europe/Moscow`
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`complete-reading-text`:
- валидирует Telegram `initData`
- завершает активный текст через RPC `complete_daily_reading_text`
- сохраняет snapshot прочитанного текста в `user_completed_reading_texts`
- возвращает актуальный `streakDays`
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`get-reading-history`:
- валидирует Telegram `initData`
- возвращает историю прочитанных текстов текущего пользователя
- использует cursor-пагинацию, чтобы история могла расти без offset-запросов
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`activate-subscription`:
- валидирует Telegram `initData`
- активирует или планирует MVP-подписку через RPC `activate_mvp_subscription`
- возвращает актуальный subscription summary
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`dev-tools`:
- валидирует Telegram `initData`
- работает только при server env `DEV_TOOLS_ENABLED="true"`
- выполняет локальные reset-действия для текущего Telegram-пользователя
- не принимает произвольный SQL, а использует фиксированный список actions
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

## 5) Transactional RPC
`public.claim_reading_generation_attempt(...)`:
- берет transaction-level advisory lock на `user_id + attempt_date`
- проверяет дневной лимит
- создает строку `reading_generation_attempts` со статусом `started`
- возвращает `attemptId`, `usedAttempts`, `remainingAttempts`

`public.complete_daily_reading_text(...)`:
- берет transaction-level advisory lock на пользователя и дату завершения
- проверяет наличие active text
- пишет дневной completion-marker для progress/streak
- копирует active text в историю завершенных текстов отдельной записью
- удаляет active text
- заполняет `users.first_text_completed_at` для онбординга

`public.activate_mvp_subscription(...)`:
- берет advisory lock по пользователю
- проверяет active и scheduled подписки
- создает `monthly` или `yearly` подписку в одной транзакции
- планирует `yearly` после active `monthly`, если такой переход доступен
