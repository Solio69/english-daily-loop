# Мои материалы и история чтения

## 1) Область документа
Документ фиксирует текущую модель раздела `Мои материалы`: как пользователь открывает
историю прочитанных текстов, где хранится snapshot завершенного текста и как frontend
получает данные.

## 2) Product rules
- Раздел `Мои материалы` открывается с главной карточки.
- В разделе есть табы `Тексты` и `Словарь`.
- Плитка `Тексты` на главной открывает раздел сразу на табе текстов.
- Плитка `Словарь` на главной открывает раздел сразу на табе словаря.
- Таб `Тексты` показывает все завершенные тексты пользователя, включая сегодняшний,
  если пользователь уже нажал `Завершить текст`.
- Таб `Словарь` показывает состояние словаря, карточки на подтверждение и подтвержденные карточки слов.

## 3) DB model
История прочитанных текстов хранится в таблице:
- `public.user_completed_reading_texts`

Ключевые поля:
- `user_id`
- `completed_date`
- `completed_at`
- `title`
- `body`
- `level`
- `estimated_minutes`
- `provider`
- `model`
- `fallback_used`
- `created_at`

Миграция создания таблицы:
- `supabase/migrations/20260427181000_create_user_completed_reading_texts.sql`

Для выдачи истории используется индекс:
- `idx_user_completed_reading_texts_user_completed`

RLS включен, frontend policies не добавлены. Доступ идет через Edge Functions с
`SUPABASE_SERVICE_ROLE_KEY`.

## 4) Completion transaction
Транзакционное завершение чтения выполняет RPC:
- `public.complete_daily_reading_text(...)`

RPC:
- берет advisory lock по пользователю и дате
- читает active text с `for update`
- пишет или обновляет дневной completion
- сохраняет snapshot текста в `user_completed_reading_texts`
- удаляет active text из `user_active_reading_texts`
- заполняет `users.first_text_completed_at` для онбординга

Миграция актуальной версии RPC:
- `supabase/migrations/20260427181100_complete_daily_reading_text_history.sql`

## 5) Edge Function
Историю отдает Edge Function:
- `supabase/functions/get-reading-history/index.ts`

Функция:
- принимает `initData`, `limit`, `cursor`
- валидирует Telegram `initData`
- находит пользователя по `telegram_user_id`
- читает только тексты текущего пользователя
- сортирует по `completed_at desc, id desc`
- возвращает `{ items, nextCursor }`

Пагинация cursor-based:
- frontend запрашивает первые `10` записей
- сервер выбирает `limit + 1`
- если есть следующая страница, возвращает cursor последней видимой записи
- кнопка `Показать еще` передает cursor в следующий запрос

## 6) Frontend
Типы:
- `src/types/materials.ts`

Сервис:
- `src/services/materialsService.ts`

Экран:
- `src/screens/MaterialsScreen.tsx`

Поведение UI:
- табы находятся вверху экрана
- карточка текста показывает дату, заголовок, preview текста, уровень, модель и время чтения
- полный текст раскрывается кнопкой `Показать полностью`
- повторное нажатие на кнопку `Свернуть` возвращает preview
- кнопка `Показать еще` догружает следующую страницу истории

## 7) Current limitations
- У истории пока нет отдельного полноэкранного detail-view.
- У таба `Словарь` пока нет серверных данных.
- Telegram `initData` validation продублирована в Edge Functions.
