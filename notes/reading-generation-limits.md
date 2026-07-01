# Попытки генерации и дневной текст

## 1) Область документа
Этот документ фиксирует MVP-логику дневных попыток генерации текста,
активного непрочитанного текста и завершения активного текста.

## 2) Product rules
- День считается по timezone `Europe/Moscow`.
- Текущий лимит для MVP зависит от подписки:
  - free: `3`
  - paid: `10`
- Попытка списывается до запроса к OpenRouter.
- Попытка списывается независимо от успеха генерации.
- Пользователь может перегенерировать текст, пока есть дневные попытки генерации.
- У пользователя может быть только один активный непрочитанный текст.
- Активный текст относится к конкретной учебной дате через `reading_date`.
- Новая успешная генерация перезаписывает предыдущий активный текст.
- Если пользователь не нажал `Завершить текст` перед новой генерацией, предыдущий активный текст теряется и не попадает в историю.
- Если пользователь не завершил активный текст до смены московской даты, он не участвует в новом дневном плане и не попадает в историю.
- Если генерация упала, активный текст не меняется.
- После нажатия `Завершить текст` активный текст сохраняется в историю, удаляется из active-состояния, а пользователь может сгенерировать следующий текст, если дневные попытки еще остались.
- Для прогресса дня и streak достаточно первого завершенного текста за дату.
- `users.first_text_completed_at` остается только онбординг-флагом.

## 3) DB model
Таблицы:
- `public.reading_generation_attempts` — одна строка на списанную попытку.
- `public.user_active_reading_texts` — текущий непрочитанный текст, одна строка на пользователя, с датой учебного дня `reading_date`.
- `public.user_daily_reading_completions` — дневной marker: пользователь завершил хотя бы один текст за конкретную дату.
- `public.user_completed_reading_texts` — snapshot каждого завершенного текста для истории пользователя; за одну дату может быть несколько строк.

Таблицы создаются миграцией:
- `supabase/migrations/20260423120000_add_reading_generation_limits.sql`

Атомарное списание попытки реализовано через RPC:
- `public.claim_reading_generation_attempt(...)`
- миграция: `supabase/migrations/20260427171000_claim_reading_generation_attempt.sql`

RPC берет transaction-level advisory lock на пару `user_id + attempt_date`, поэтому два параллельных запроса одного пользователя за один день не могут одновременно пройти проверку лимита.

Транзакционное завершение чтения реализовано через RPC:
- `public.complete_daily_reading_text(...)`
- миграция: `supabase/migrations/20260427172000_complete_daily_reading_text.sql`

RPC одним DB-действием проверяет наличие active text для даты завершения, записывает дневной completion-marker, сохраняет snapshot текста в историю, удаляет active text и заполняет `users.first_text_completed_at`, если это первый текст пользователя.

История прочитанных текстов хранится отдельно:
- таблица: `public.user_completed_reading_texts`
- миграция: `supabase/migrations/20260427181000_create_user_completed_reading_texts.sql`

При завершении чтения RPC копирует активный текст в историю перед удалением active text:
- миграция: `supabase/migrations/20260427181100_complete_daily_reading_text_history.sql`

RLS включен, frontend policies не добавлены.
Доступ идет через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.

## 4) Edge Functions
`get-reading-state`:
- валидирует `Telegram initData`
- считает текущую дату по `Europe/Moscow`
- возвращает `activeText` текущей московской даты, `dailyLimit`, `usedAttempts`, `remainingAttempts`, `isReadingCompletedToday`

`generate-reading-text`:
- валидирует `Telegram initData`
- атомарно проверяет дневной лимит и записывает attempt со статусом `started`
- вызывает OpenRouter primary/fallback модели
- при успехе перезаписывает `user_active_reading_texts` и записывает `reading_date`
- обновляет attempt в `succeeded` или `failed`

`complete-reading-text`:
- валидирует `Telegram initData`
- транзакционно завершает чтение через RPC `complete_daily_reading_text`
- требует наличие active text текущей московской даты
- пишет строку в `user_daily_reading_completions`
- сохраняет snapshot текста в `user_completed_reading_texts`
- удаляет активный текст
- если это первый прочитанный текст, заполняет `users.first_text_completed_at`

`get-reading-history`:
- валидирует `Telegram initData`
- возвращает завершенные тексты пользователя из `user_completed_reading_texts`
- поддерживает cursor-пагинацию через `limit` и `cursor`

`auth-telegram`:
- дополнительно возвращает `homeProgress.reading.status` для главного экрана:
  - `not_started`
  - `in_progress`
  - `completed`

## 5) Frontend behavior
Файл:
- `src/services/readingService.ts`
- `src/services/materialsService.ts`

Сервисные методы:
- `getReadingState()`
- `generateReadingText()`
- `completeReadingText()`
- `getReadingHistory()`

Файл:
- `src/screens/ReadingScreen.tsx`
- `src/screens/MaterialsScreen.tsx`

Поведение UI:
- при входе загружает состояние с сервера
- показывает активный текст текущей московской даты, если он есть
- показывает попытки в формате `remaining/dailyLimit`
- во время новой генерации скрывает предыдущий текст, но не удаляет его из state
- если новая генерация упала, показывает ошибку, а предыдущий active text текущей даты снова виден
- после завершения текста сохраняет его в историю, очищает active-состояние и возвращает пользователя на главную
- главная карточка `Текст` использует серверный `homeProgress.reading.status`
- раздел `Мои материалы` показывает завершенные тексты карточками-превью и догружает историю кнопкой `Показать еще`

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
  public.user_completed_reading_texts,
  public.user_daily_reading_completions;

update public.users
set first_text_completed_at = null
where telegram_user_id = 999000001;
```

## 7) Future improvements
- Вынести Telegram initData validation в общий модуль Edge Functions.
- Вынести расчет московской даты в общий helper.
- Добавить детальный просмотр текста из истории, если продуктово понадобится повторное открытие полного текста.
