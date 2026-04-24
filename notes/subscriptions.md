# MVP-подписки

## 1) Область документа
Документ фиксирует текущую модель подписок в MVP.

Важно: `free/paid` здесь не являются ролями доступа. Это тарифное состояние пользователя.
Админская роль и режим тестирования админа отложены.

## 2) Product rules
- Если у пользователя нет активной подписки, он считается `free`.
- Если есть активная подписка, он считается `paid`.
- Активная подписка определяется сервером по интервалу:
  - `starts_at <= now`
  - `ends_at > now`
- `monthly` в MVP действует 1 день от момента оформления.
- `yearly` в MVP действует 7 дней от момента оформления.
- Цена на обоих планах пока `0`.
- Окончание подписки показывается пользователю в timezone `Europe/Moscow`.
- Даты хранятся в БД как `timestamptz`.

## 3) Limits
Текущие лимиты:
- free:
  - `dailyReadingGenerations`: `3`
  - `vocabularyWordsLimit`: `30`
- paid:
  - `dailyReadingGenerations`: `10`
  - `vocabularyWordsLimit`: `300`

Лимит генераций считается только на сервере в Edge Functions.
Фронт отображает `dailyLimit`, `remainingAttempts` и `subscription.limits`, но не принимает решение о доступе.

## 4) DB model
Таблица:
- `public.user_subscriptions`

Поля:
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references public.users(id) on delete cascade`
- `plan_type text not null check in ('monthly', 'yearly')`
- `starts_at timestamptz not null`
- `ends_at timestamptz not null`
- `source text not null default 'mvp_zero_price'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Миграция:
- `supabase/migrations/20260423133000_create_user_subscriptions.sql`

RLS включен, frontend policies не добавлены.
Доступ идет через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.

## 5) Edge Functions
`auth-telegram`:
- валидирует `Telegram initData`
- делает find-or-create пользователя
- возвращает `subscription` summary:
  - `tier`
  - `limits`
  - `activeSubscription`
  - `scheduledSubscription`
  - дополнительно возвращает `homeProgress.reading.status` для главного экрана

`activate-subscription`:
- валидирует `Telegram initData`
- принимает `planType: monthly | yearly`
- находит пользователя по `telegram_user_id`
- создает строку в `user_subscriptions`
- если active monthly и выбран yearly, создает yearly с `starts_at = currentMonthly.ends_at`
- если active yearly, возвращает business error
- если active monthly и снова выбран monthly, возвращает business error

`get-reading-state` и `generate-reading-text`:
- читают активную подписку пользователя
- возвращают/используют `dailyLimit = 3` для free и `dailyLimit = 10` для paid

## 6) Frontend
Типы:
- `src/types/subscription.ts`
- `AppUser.subscription` в `src/types/user.ts`

Сервисы:
- `src/services/userService.ts` получает subscription summary из `auth-telegram`
- `src/services/subscriptionService.ts` вызывает `activate-subscription`

UI:
- `src/screens/HomeScreen.tsx` показывает кнопку subscription рядом с индикатором streak
- `src/screens/SubscriptionScreen.tsx` показывает текущий статус, лимиты и доступные действия
- после успешной активации `App.tsx` обновляет `appUser.subscription` без перезагрузки приложения и показывает toast

## 7) Local dev notes
- После добавления миграции в уже существующую локальную БД нужно применить ее:

```bash
npx supabase migration up
```

- Полный reset локальной БД также применит миграцию и seed:

```bash
npx supabase db reset
```

- `npm run dev:all` поднимает `activate-subscription` вместе с остальными Edge Functions.

## 8) Current limitations
- Реальная платежная система не подключена.
- `source = 'mvp_zero_price'` используется как явный маркер тестовой бесплатной активации.
- Продление monthly поверх monthly пока не реализовано.
- При active yearly пользователь пока не видит действий оформления.
- Логика subscription summary продублирована в нескольких Edge Functions; перед production стоит вынести общие helpers.
- Проверка лимита и запись generation attempt пока не атомарны.
