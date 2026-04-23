# Попытки генерации и дневной текст

> Update 2026-04-23: daily generation limit is no longer fixed at `10`.
> It is now subscription-based: free = `3`, paid = `10`.
> See `notes/subscriptions.md`.

## 1) Область документа
Этот документ фиксирует MVP-логику дневных попыток генерации текста,
активного непрочитанного текста и завершения дневного чтения.

## 2) Product rules
- День считается по timezone `Europe/Moscow`.
- Текущий лимит для MVP: `10` попыток генерации в день для всех пользователей.
- Будущая модель тарифов должна расширять `getDailyGenerationLimit(user)`.
- Попытка списывается до запроса к OpenRouter.
- Попытка списывается независимо от успеха генерации.
- Пользователь может перегенерировать текст, пока не завершил чтение за текущий день.
- У пользователя может быть только один активный непрочитанный текст.
- Новая успешная генерация перезаписывает предыдущий активный текст.
- Если генерация упала, активный текст не меняется.
- После нажатия "Завершить текст" генерация в текущий день блокируется.
- `users.first_text_completed_at` остается только онбординг-флагом.

## 3) DB model
Таблицы:
- `public.reading_generation_attempts` — одна строка на списанную попытку.
- `public.user_active_reading_texts` — текущий непрочитанный текст, одна строка на пользователя.
- `public.user_daily_reading_completions` — факт завершения чтения за конкретную дату.

Все три таблицы создаются миграцией:
- `supabase/migrations/20260423120000_add_reading_generation_limits.sql`

RLS включен, frontend policies не добавлены.
Доступ идет через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.

## 4) Edge Functions
`get-reading-state`:
- валидирует `Telegram initData`
- считает текущую дату по `Europe/Moscow`
- возвращает `activeText`, `dailyLimit`, `usedAttempts`, `remainingAttempts`, `isReadingCompletedToday`

`generate-reading-text`:
- валидирует `Telegram initData`
- проверяет дневное завершение
- проверяет дневной лимит
- записывает attempt со статусом `started`
- вызывает OpenRouter primary/fallback модели
- при успехе перезаписывает `user_active_reading_texts`
- обновляет attempt в `succeeded` или `failed`

`complete-reading-text`:
- валидирует `Telegram initData`
- требует наличие активного текста
- пишет строку в `user_daily_reading_completions`
- удаляет активный текст
- если это первый прочитанный текст, заполняет `users.first_text_completed_at`

## 5) Frontend behavior
Файл:
- `src/services/readingService.ts`

Сервисные методы:
- `getReadingState()`
- `generateReadingText()`
- `completeReadingText()`

Файл:
- `src/screens/ReadingScreen.tsx`

Поведение UI:
- при входе загружает состояние с сервера
- показывает активный текст, если он есть
- показывает попытки в формате `remaining/dailyLimit`
- во время новой генерации скрывает предыдущий текст, но не удаляет его из state
- если новая генерация упала, показывает ошибку, а предыдущий активный текст снова виден
- после завершения текста очищает экран и блокирует генерацию до следующего дня

## 6) Local dev reset
Для полного сброса локальной БД:

```bash
npx supabase db reset
```

Для ручного сброса только состояния чтения dev-пользователя:

```sql
truncate table
  public.reading_generation_attempts,
  public.user_active_reading_texts,
  public.user_daily_reading_completions;

update public.users
set first_text_completed_at = null
where telegram_user_id = 999000001;
```

## 7) Future improvements
- Сделать атомарную DB/RPC-операцию проверки лимита и списания attempt.
- Вынести Telegram initData validation в общий модуль Edge Functions.
- Вынести расчет московской даты в общий helper.
- Добавить тарифы free/paid и хранение subscription state.
- Добавить историю прочитанных текстов, если продуктово понадобится аналитика или повторное открытие.
