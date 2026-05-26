# Сохранение слов в словарь

## 1) Область документа
Документ фиксирует текущий словарный модуль: пользователь быстро добавляет слово из
активного текста, а карточки готовятся позже в словаре batch-запросом к AI и
подтверждаются пользователем.

Повторение слов, удаление, архив и spaced repetition в этот этап не входят.

## 2) Product rules
- Слова добавляются только из активного текста на экране `Текст`.
- Слово сохраняется сразу, даже если пользователь позже не нажмет `Завершить текст`.
- Добавление слова не завершает чтение автоматически и не засчитывает дневной прогресс.
- Добавление слова не вызывает AI.
- При добавлении сохраняется нормализованная выбранная форма слова.
- Карточка слова создается позже в табе `Словарь`.
- Если слово уже есть в статусе `unlearned`, новая карточка не создается.
- Если слово уже есть в статусе `learned`, сервер возвращает его в `unlearned`,
  если лимит словаря не исчерпан.
- Если слова нет, сервер проверяет лимит словаря и сохраняет pending-слово.
- При подготовке карточек валидные AI-карточки сохраняются и переходят в `needs_approval`; слова, для которых AI не вернул валидную карточку, остаются в `pending`.

## 3) Limits
Лимит словаря зависит от активной подписки:
- `free`: `30` слов
- `paid`: `300` слов

Проверка лимита выполняется на сервере. Frontend только показывает результат.

## 4) DB model
Таблица карточек:
- `public.user_vocabulary_words`

Ключевые поля:
- `user_id`
- `word`
- `translation`
- `part_of_speech`
- `is_verb`
- `is_regular_verb`
- `verb_forms`
- `examples`
- `status`: `unlearned | learned`
- `card_status`: `pending | needs_approval | ready`
- `learned_at`

Уникальность:
- `(user_id, lower(word))`

Таблица источников:
- `public.user_vocabulary_word_sources`

Ключевые поля:
- `user_id`
- `word_id`
- `reading_text_id`
- `word_index`
- `original_word`

Источник нужен, чтобы понимать, из какого текста и с какой позиции пользователь добавил
слово. Если активный текст позже завершится, тот же `reading_text_id` переносится в
`user_completed_reading_texts`.

Активный и завершенный текст получили стабильный `reading_text_id`:
- `public.user_active_reading_texts.reading_text_id`
- `public.user_completed_reading_texts.reading_text_id`

Миграция:
- `supabase/migrations/20260511120000_add_vocabulary_word_saving.sql`
- `supabase/migrations/20260511133000_make_vocabulary_cards_pending.sql`
- `supabase/migrations/20260511143000_add_vocabulary_card_approval.sql`
- `supabase/migrations/20260511150000_add_pending_vocabulary_word_save_rpc.sql`

## 5) Transactional RPC
Атомарное сохранение слова и источника выполняет RPC:
- `public.save_pending_vocabulary_word_with_source(...)`

RPC:
- берет advisory lock по пользователю;
- проверяет существующее слово;
- блокирует reactivation/new insert при исчерпанном лимите;
- создает новое слово с `card_status = pending`, если слово еще не существует;
- сохраняет source для текущего `reading_text_id` и `word_index`.

RPC доступен только `service_role`.

## 6) Edge Function
Функция сохранения:
- `supabase/functions/save-vocabulary-word/index.ts`

Вход:
- `initData`
- `readingTextId`
- `word`
- `wordIndex`

Функция:
1. Валидирует Telegram `initData`.
2. Находит пользователя по `telegram_user_id`.
3. Проверяет активный текст и совпадение `readingTextId`.
4. Проверяет, что `wordIndex` указывает на это слово в активном тексте.
5. Нормализует выбранную форму слова.
6. Через RPC проверяет дубль, лимит словаря, сохраняет pending-слово и source.

Функция состояния:
- `supabase/functions/get-vocabulary-state/index.ts`

Возвращает:
- количество `pending` слов;
- количество `needs_approval` карточек;
- количество `ready` карточек;
- общее количество слов.

Функция подготовки карточек:
- `supabase/functions/prepare-vocabulary-cards/index.ts`

Функция:
1. Валидирует Telegram `initData`.
2. Берет первые `5` pending-слов пользователя.
3. Отправляет их одним prompt в OpenRouter.
4. Валидирует массив AI-карточек и пропускает невалидные элементы batch-а.
5. Для валидных карточек заполняет поля слова и ставит `card_status = needs_approval`.
6. Оставляет слова без валидной карточки в `pending`.
7. Возвращает статистику подготовки.

Функция списка карточек:
- `supabase/functions/get-vocabulary-words/index.ts`

Возвращает:
- карточки `needs_approval`;
- карточки `ready`.

Функция подтверждения:
- `supabase/functions/approve-vocabulary-card/index.ts`

Меняет `card_status` с `needs_approval` на `ready` только для карточки текущего пользователя.

Функция массового подтверждения:
- `supabase/functions/approve-vocabulary-cards/index.ts`

Меняет `card_status` с `needs_approval` на `ready` для всех карточек текущего
пользователя и возвращает количество подтвержденных карточек. Операция остается
server-side: frontend отправляет только намерение пользователя, а выбор строк идет
по Telegram-пользователю после серверной валидации `initData`.

OpenRouter key остается только на сервере.

Общий OpenRouter client и allowlist моделей находятся в:
- `supabase/functions/_shared/openrouter.ts`

Общие проверки AI-текста находятся в:
- `supabase/functions/_shared/ai-text.ts`

Доменная валидация карточек слов находится в:
- `supabase/functions/prepare-vocabulary-cards/ai-pipeline.ts`

## 7) Frontend
Типы:
- `src/types/vocabulary.ts`

Сервис:
- `src/services/vocabularyService.ts`

Экран:
- `src/screens/ReadingScreen.tsx`

UI:
- пользователь нажимает слово в активном тексте;
- нажимает `Добавить`;
- frontend вызывает `save-vocabulary-word`;
- слово подсвечивается только после успешного ответа сервера;
- при ошибке показывается сообщение, слово не подсвечивается как сохраненное.
- таб `Словарь` показывает summary-карточку с meta row `Всего` / `В словаре` и двумя compact warm status cards `Добавить` / `Подтвердить`;
- pending-слова показываются внутри fixed-height action-блока с контекстом `N слов без карточек` и CTA `Готовить`;
- во время подготовки CTA сохраняет размеры и показывает loader вместо sparkles-иконки;
- если подготовка карточек завершилась ошибкой, `InlineStatusCard` показывается под action-блоком и над информационным блоком;
- информационный блок под action объясняет, что AI готовит карточки партиями и после проверки они попадают в подтверждение;
- после AI-подготовки карточки попадают в блок `Требуют подтверждения`;
- пользователь раскрывает карточку, проверяет часть речи, формы глагола и примеры, затем нажимает `Подтвердить`;
- пользователь может подтвердить все карточки на проверке через bulk-кнопку `Все · N`;
- bulk-подтверждение открывает warning-confirmation modal и после подтверждения вызывает `approve-vocabulary-cards`;
- во время bulk-подтверждения кнопка сохраняет размер и показывает loader, а карточки на проверке не раскрываются;
- только карточки с `card_status = ready` попадают в обычный список `Словарь`;
- кнопка `Редактировать` пока отображается выключенной, само редактирование будет отдельным этапом.
- раскрытая карточка автоматически докручивается в видимую область, чтобы actions не скрывались под нижней навигацией;
- встроенные ошибки подготовки, загрузки, одиночного и массового подтверждения отображаются через `InlineStatusCard`.

## 8) Error behavior
Пользовательские ошибки:
- лимит словаря исчерпан;
- активный текст изменился или недоступен;
- AI не смог подготовить ни одной валидной карточки в batch-е;
- сервер не смог проверить или сохранить словарь.

Технические детали AI/provider/SQL не возвращаются клиенту.
