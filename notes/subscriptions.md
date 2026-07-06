# MVP-подписки

## 1) Область документа
Документ фиксирует текущую модель доступа, ролей и подписок в MVP.

Важно: `free/paid` здесь не являются ролями доступа. Это тарифное состояние пользователя.
Роли приложения хранятся отдельно в `public.users.app_role`: `admin`, `tester`, `user`.
`admin` и `tester` получают internal paid-like доступ без фиктивной строки в `user_subscriptions`; новые пользователи по умолчанию создаются как `tester`.

## 2) Product rules
- Если у пользователя нет активной подписки, он считается `free`.
- Если есть активная подписка, он считается `paid`.
- Если роль пользователя `admin` или `tester`, он считается `paid` через `accessType = internal`.
- `admin` может пользоваться dev tools при включенном server env `DEV_TOOLS_ENABLED`; `tester` получает только расширенные лимиты.
- Активная подписка определяется сервером по интервалу:
  - `starts_at <= now`
  - `ends_at > now`
- `monthly` в MVP действует 1 день от момента оформления.
- `yearly` в MVP действует 7 дней от момента оформления.
- Цена на обоих планах пока `0`.
- Окончание подписки показывается пользователю в timezone `Europe/Moscow`.
- Даты хранятся в БД как `timestamptz`.
- Пользовательский flow подписки скрыт в интерфейсе до подключения реальной оплаты.

## 3) Limits
Текущие лимиты:
- free:
  - `dailyReadingGenerations`: `3`
  - `vocabularyWordsLimit`: `30`
  - `dailyVocabularyCardGenerations`: `5`
- paid:
  - `dailyReadingGenerations`: `10`
  - `vocabularyWordsLimit`: `300`
  - `dailyVocabularyCardGenerations`: `20`

Лимиты генерации текстов и подготовки AI-карточек словаря считаются только на сервере в Edge Functions.
Фронт отображает `dailyLimit`, `remainingAttempts`, `subscription.limits` и состояние `cardGeneration`, но не принимает решение о доступе.

## 4) DB model
Таблица ролей:
- `public.users`

Поле роли:
- `app_role text not null default 'tester' check in ('admin', 'tester', 'user')`

Миграция роли:
- `supabase/migrations/20260706120000_add_user_app_roles.sql`

Таблица подписок:
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

Транзакционная активация подписки реализована через RPC:
- `public.activate_mvp_subscription(...)`
- миграция: `supabase/migrations/20260427173000_activate_mvp_subscription.sql`

RPC берет advisory lock на пользователя, проверяет active/scheduled подписки и создает новую строку в одной транзакции. Это защищает от дублей при параллельных запросах оформления.

RLS включен, frontend policies не добавлены.
Доступ идет через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.

## 5) Edge Functions
`auth-telegram`:
- валидирует `Telegram initData`
- делает find-or-create пользователя
- возвращает `subscription` summary:
  - `tier`
  - `accessType`
  - `limits`
  - `activeSubscription`
  - `scheduledSubscription`
  - дополнительно возвращает `homeProgress.reading.status` для главного экрана

`activate-subscription`:
- остается server-side заготовкой для будущего пользовательского flow подписки
- требует `SUBSCRIPTION_FLOW_ENABLED="true"`
- валидирует `Telegram initData`
- принимает `planType: monthly | yearly`
- находит пользователя по `telegram_user_id`
- транзакционно создает строку в `user_subscriptions` через RPC `activate_mvp_subscription`
- если active monthly и выбран yearly, создает yearly с `starts_at = currentMonthly.ends_at`
- если active yearly, возвращает business error
- если active monthly и снова выбран monthly, возвращает business error

`get-reading-state` и `generate-reading-text`:
- читают effective access пользователя через `supabase/functions/_shared/access.ts`
- возвращают/используют `dailyLimit = 3` для free и `dailyLimit = 10` для paid/internal

## 6) Frontend
Типы:
- `src/types/subscription.ts`
- `AppUser.subscription` в `src/types/user.ts`

Сервисы:
- `src/services/userService.ts` получает subscription summary из `auth-telegram`
- `src/services/subscriptionService.ts` вызывает `activate-subscription`
- `src/constants/subscriptionFallbacks.ts` содержит client fallback для bootstrap; роли, лимиты и paid/internal доступ считаются на сервере

UI:
- `src/constants/subscriptionFeatures.ts` скрывает пользовательский entry подписки через `SHOW_SUBSCRIPTION_FLOW = false`
- `src/screens/HomeScreen.tsx` не показывает кнопку subscription, пока flow выключен
- `src/screens/SubscriptionScreen.tsx` сохранен для будущего платежного flow
- после успешной активации `App.tsx` обновляет `appUser.subscription` без перезагрузки приложения и показывает toast
- `src/App.tsx` показывает dev tools только при `appUser.role === "admin"`

## 7) Local dev notes
- После добавления миграции в уже существующую локальную БД нужно применить ее:

```bash
npx supabase migration up
```

- Полный reset локальной БД также применит миграцию и seed:

```bash
npx supabase db reset
```

- `npm run dev:telegram` поднимает `activate-subscription` вместе с остальными Edge Functions.
- `SUBSCRIPTION_FLOW_ENABLED` держим `"false"`, пока пользовательский flow подписки скрыт.

## 8) Current limitations
- Реальная платежная система не подключена.
- Пользовательский экран подписки скрыт.
- `source = 'mvp_zero_price'` используется как явный маркер тестовой бесплатной активации.
- Продление monthly поверх monthly пока не реализовано.
- При active yearly пользователь пока не видит действий оформления.
