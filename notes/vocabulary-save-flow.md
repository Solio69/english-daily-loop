# Сохранение слов в словарь

## 1) Область документа
Документ фиксирует подготовку словарной карточки: пользователь быстро добавляет слово
из активного текста, карточка готовится позже batch-запросом к AI и подтверждается
пользователем. Подтвержденная карточка сразу доступна в дневном повторении, которое
описано в `notes/vocabulary-review.md`.

## 2) Product rules
- Слова добавляются только из активного текста на экране `Текст`.
- Слово сохраняется сразу, даже если пользователь позже не нажмет `Завершить текст`.
- Добавление слова не завершает чтение автоматически и не засчитывает дневной прогресс.
- Добавление слова не вызывает AI.
- При добавлении сохраняется нормализованная выбранная форма слова.
- Карточка слова создается позже в табе `Словарь`.
- Если слово уже есть в статусе `not_started` или `active`, новая карточка не создается.
- Если слово уже есть в статусе `learned`, сервер возвращает его в `not_started` и
  сбрасывает данные повторения. Существующая строка не увеличивает размер словаря.
- Если слова нет, сервер проверяет лимит словаря и сохраняет pending-слово.
- При подготовке карточек валидные AI-карточки сохраняются и переходят в `needs_approval`; слова, для которых AI не вернул валидную карточку, остаются в `pending`.
- Если AI приводит pending-слово к канонической форме, которая уже есть у пользователя,
  pending-дубликат мержится в существующую карточку.
- При merge источники слова переносятся на существующую каноническую карточку, а
  pending-запись удаляется. Прогресс `active`-слова сохраняется; `learned`-слово
  возвращается в `not_started` со сброшенным прогрессом.

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
- `status`: `not_started | active | learned`
- `card_status`: `pending | needs_approval | ready`
- `review_step`
- `next_review_date`
- `last_reviewed_at`
- `review_count` и счетчики действий
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

Если pending-слово при AI-подготовке приводится к уже существующей канонической форме,
source переносится с pending-записи на существующую карточку. В словаре остается одна
карточка на каноническую форму, но у нее может быть несколько источников из разных текстов
и исходных форм.

Активный и завершенный текст получили стабильный `reading_text_id`:
- `public.user_active_reading_texts.reading_text_id`
- `public.user_completed_reading_texts.reading_text_id`

Миграция:
- `supabase/migrations/20260511120000_add_vocabulary_word_saving.sql`
- `supabase/migrations/20260511133000_make_vocabulary_cards_pending.sql`
- `supabase/migrations/20260511143000_add_vocabulary_card_approval.sql`
- `supabase/migrations/20260511150000_add_pending_vocabulary_word_save_rpc.sql`
- `supabase/migrations/20260618120000_add_vocabulary_review_flow.sql`
- `supabase/migrations/20260622120000_harden_vocabulary_review_state.sql`

## 5) Transactional RPC
Атомарное сохранение слова и источника выполняет RPC:
- `public.save_pending_vocabulary_word_with_source(...)`

RPC:
- берет advisory lock по пользователю;
- проверяет существующее слово;
- проверяет лимит словаря только перед созданием новой строки;
- реактивирует существующее `learned`-слово независимо от заполненности лимита;
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
4. При невалидном AI-ответе или provider-ошибке отдельной модели пробует следующую модель из server-side allowlist.
5. Валидирует массив AI-карточек и пропускает невалидные элементы batch-а.
6. Для валидных карточек заполняет поля слова и ставит `card_status = needs_approval`.
7. Если каноническая форма уже есть у пользователя, переносит sources на существующую
   карточку и удаляет pending-дубликат. Прогресс `active`-слова сохраняется, а
   `learned`-слово возвращается в `not_started`.
8. Оставляет слова без валидной карточки в `pending`.
9. Возвращает статистику подготовки: `preparedCount`, `failedCount`, `mergedCount`,
   `reactivatedCount`, `remainingPendingCount`, `needsApprovalCount`.

Валидация AI-карточки проверяет слово, перевод, часть речи, verb-данные и примеры.
Echo-поле `level` от AI не используется как blocker: сервер сам знает уровень пользователя
и сохраняет карточку с серверным уровнем.

Функция списка карточек:
- `supabase/functions/get-vocabulary-words/index.ts`

Возвращает:
- карточки `needs_approval`;
- карточки `ready`.

Функция подтверждения:
- `supabase/functions/approve-vocabulary-card/index.ts`

Меняет `card_status` с `needs_approval` на `ready` только для карточки текущего
пользователя, устанавливает `status = not_started` и очищает данные повторения.

Функция массового подтверждения:
- `supabase/functions/approve-vocabulary-cards/index.ts`

Меняет `card_status` с `needs_approval` на `ready` для всех карточек текущего
пользователя и возвращает количество подтвержденных карточек. Операция остается
server-side: frontend отправляет только намерение пользователя, а выбор строк идет
по Telegram-пользователю после серверной валидации `initData`. Подтвержденные карточки
получают `status = not_started` и доступны в повторении текущего дня.

OpenRouter key остается только на сервере.

Общий OpenRouter client и allowlist моделей находятся в:
- `supabase/functions/_shared/openrouter.ts`

Общие проверки AI-текста находятся в:
- `supabase/functions/_shared/ai-text.ts`

Доменная валидация карточек слов находится в:
- `supabase/functions/prepare-vocabulary-cards/ai-pipeline.ts`

Сохранение подготовленных карточек и merge pending-дубликатов находятся в:
- `supabase/functions/prepare-vocabulary-cards/card-persistence.ts`

## 7) Frontend
Типы:
- `src/types/vocabulary.ts`

Сервис:
- `src/services/vocabularyService.ts`

Экран:
- `src/screens/ReadingScreen.tsx`
- `src/screens/MaterialsScreen.tsx`

UI:
- пользователь нажимает слово в активном тексте;
- нажимает `Добавить`;
- frontend вызывает `save-vocabulary-word`;
- слово подсвечивается только после успешного ответа сервера;
- при ошибке показывается сообщение, слово не подсвечивается как сохраненное.
- таб `Словарь` показывает summary-карточку с двумя compact status cards `Добавить` / `Подтвердить`;
- status cards используют иконки `Layers` и `CircleCheck`; активные значения подсвечиваются warm-состоянием, нулевые значения показываются как blue ready-state `Все готовы` / `Подтверждено`;
- pending-слова показываются внутри fixed-height action-блока с контекстом `N слов без карточек` и CTA `Готовить`;
- во время подготовки CTA сохраняет размеры и показывает loader вместо sparkles-иконки;
- если подготовка карточек завершилась ошибкой, `InlineStatusCard` показывается под action-блоком и над информационным блоком;
- информационный блок под action объясняет, что AI готовит карточки партиями и после проверки они попадают в подтверждение;
- после AI-подготовки карточки попадают в блок `Требуют подтверждения`;
- пользователь раскрывает карточку, проверяет часть речи, формы глагола и примеры, затем нажимает `Подтвердить`;
- пользователь может подтвердить все карточки на проверке через bulk action `Подтвердить все N AI-карточку/карточки/карточек`;
- bulk-подтверждение открывает bottom confirmation modal с действиями `Отменить` и `Подтвердить`; после подтверждения вызывает `approve-vocabulary-cards`;
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

## 9) Vocabulary card generation attempts

- Лимит batch-подготовки AI-карточек зависит от подписки: `free` = `5` попыток в день, `paid` = `20` попыток в день.
- 1 попытка = 1 вызов `prepare-vocabulary-cards` для batch до `5` pending-слов.
- Попытка списывается до вызова OpenRouter и сгорает даже при AI/provider/validation ошибке.
- Если pending-слов нет, попытка не списывается.
- Попытки хранятся в `public.vocabulary_card_generation_attempts`.
- Атомарное списание делает RPC `public.claim_vocabulary_card_generation_attempt(...)` с advisory lock на пользователя и дату.
- Общая server-логика лимита, подсчета и обновления metadata попытки находится в `supabase/functions/_shared/vocabulary-card-generation.ts`.
- `get-vocabulary-state` возвращает `cardGeneration.dailyLimit`, `usedAttempts`, `remainingAttempts`.
- Dev tools имеют отдельный action `reset_vocabulary_card_attempts`.

## 10) Связь с повторением

- `card_status` отвечает за готовность содержимого карточки: `pending`,
  `needs_approval`, `ready`.
- `status` отвечает за учебный прогресс: `not_started`, `active`, `learned`.
- В очередь попадают только `ready`-карточки.
- Отдельный flow и серверные гарантии описаны в
  `notes/vocabulary-review.md`.
