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
- завершать дневное чтение
- активировать подписки

Эти действия выполняются в Supabase Edge Functions с серверными секретами.

## 3) RLS
RLS включен для:
- `public.users`
- `public.user_settings`

Миграция:
- `supabase/migrations/20260427165000_enable_rls_for_users_and_settings.sql`

Frontend policies для этих таблиц не добавлены. Доступ идет через Edge Functions с
`SUPABASE_SERVICE_ROLE_KEY`. Это сохраняет простую MVP-модель: пользовательская сессия
подтверждается Telegram `initData`, а не Supabase Auth session.

## 4) Edge Functions
`auth-telegram`:
- валидирует Telegram `initData`
- создает или находит пользователя по `telegram_user_id`
- возвращает `settings`, `subscription`, `homeProgress` и `streakDays`
- разделяет ошибки Telegram validation и внутренние DB/server ошибки

`save-user-settings`:
- валидирует Telegram `initData`
- проверяет значения настроек
- сохраняет `english_level`, `daily_exercise_minutes`, `daily_reading_minutes`
- заполняет `users.settings_completed_at`, если настройки сохраняются впервые
- возвращает актуальное состояние пользователя для frontend

`generate-reading-text`:
- валидирует Telegram `initData`
- проверяет настройки, подписку и дневной completion
- списывает попытку через RPC `claim_reading_generation_attempt`
- сохраняет активный AI-текст при успешной генерации

`complete-reading-text`:
- валидирует Telegram `initData`
- завершает дневное чтение через RPC `complete_daily_reading_text`
- сохраняет snapshot прочитанного текста в `user_completed_reading_texts`
- возвращает актуальный `streakDays`

`get-reading-history`:
- валидирует Telegram `initData`
- возвращает историю прочитанных текстов текущего пользователя
- использует cursor-пагинацию, чтобы история могла расти без offset-запросов

`activate-subscription`:
- валидирует Telegram `initData`
- активирует или планирует MVP-подписку через RPC `activate_mvp_subscription`
- возвращает актуальный subscription summary

## 5) Transactional RPC
`public.claim_reading_generation_attempt(...)`:
- берет transaction-level advisory lock на `user_id + attempt_date`
- проверяет дневной лимит
- создает строку `reading_generation_attempts` со статусом `started`
- возвращает `attemptId`, `usedAttempts`, `remainingAttempts`

`public.complete_daily_reading_text(...)`:
- берет transaction-level advisory lock на пользователя и дату завершения
- проверяет наличие active text
- пишет или обновляет дневной completion
- копирует active text в историю завершенных текстов
- удаляет active text
- заполняет `users.first_text_completed_at` для онбординга

`public.activate_mvp_subscription(...)`:
- берет advisory lock по пользователю
- проверяет active и scheduled подписки
- создает `monthly` или `yearly` подписку в одной транзакции
- планирует `yearly` после active `monthly`, если такой переход доступен

## 6) Dev auth fallback
Dev fallback доступен только при явном:

```env
VITE_ENABLE_DEV_AUTH_FALLBACK="true"
```

И frontend, и Edge Functions используют эту переменную как opt-in. Для Telegram-запуска и
production-like проверок значение должно быть:

```env
VITE_ENABLE_DEV_AUTH_FALLBACK="false"
```
