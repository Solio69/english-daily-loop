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
- сохранять или готовить словарные карточки
- изменять шаг и дату повторения слова

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
- `public.user_vocabulary_words`
- `public.user_vocabulary_word_sources`
- `public.vocabulary_card_generation_attempts`
- `public.user_daily_vocabulary_review_completions`

Миграции:
- `supabase/migrations/20260427165000_enable_rls_for_users_and_settings.sql`
- `supabase/migrations/20260423120000_add_reading_generation_limits.sql`
- `supabase/migrations/20260423133000_create_user_subscriptions.sql`
- `supabase/migrations/20260427181000_create_user_completed_reading_texts.sql`
- `supabase/migrations/20260430120000_harden_public_api_permissions.sql`
- `supabase/migrations/20260511120000_add_vocabulary_word_saving.sql`
- `supabase/migrations/20260528120000_add_vocabulary_card_generation_attempts.sql`
- `supabase/migrations/20260618120000_add_vocabulary_review_flow.sql`
- `supabase/migrations/20260622120000_harden_vocabulary_review_state.sql`

Frontend policies для защищенных таблиц не добавлены. Для `anon` и `authenticated`
явно закрыт прямой доступ к пользовательским, reading-state, completion/history и
subscription таблицам, а также к server-only RPC. Доступ идет через Edge Functions с
`SUPABASE_SERVICE_ROLE_KEY`. Это сохраняет простую MVP-модель: пользовательская сессия
подтверждается Telegram `initData`, а не Supabase Auth session.

## 4) Edge Functions
`auth-telegram`:
- валидирует Telegram `initData`
- создает или находит пользователя по `telegram_user_id`
- возвращает `role`, `settings`, `subscription`, `homeProgress` и `streakDays`
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
- возвращает active text текущей московской даты, дневной лимит, использованные/оставшиеся попытки и флаг завершения чтения за день
- считает дневной цикл по timezone `Europe/Moscow`
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`complete-reading-text`:
- валидирует Telegram `initData`
- завершает active text текущей московской даты через RPC `complete_daily_reading_text`
- сохраняет snapshot прочитанного текста в `user_completed_reading_texts`
- возвращает актуальный `streakDays`
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`get-reading-history`:
- валидирует Telegram `initData`
- возвращает историю прочитанных текстов текущего пользователя
- использует cursor-пагинацию, чтобы история могла расти без offset-запросов
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`activate-subscription`:
- работает только при server env `SUBSCRIPTION_FLOW_ENABLED="true"`
- валидирует Telegram `initData`
- остается server-side заготовкой для будущего пользовательского subscription flow
- активирует или планирует MVP-подписку через RPC `activate_mvp_subscription`
- возвращает актуальный subscription summary
- возвращает клиенту безопасное сообщение для неожиданных внутренних ошибок

`save-vocabulary-word`, `prepare-vocabulary-cards`, `approve-vocabulary-card`,
`approve-vocabulary-cards`:
- валидируют Telegram `initData`;
- работают только со словами текущего пользователя;
- проверяют лимит словаря и попыток подготовки server-side;
- сохраняют валидные подготовленные карточки как `ready + not_started`;
- держат approve-функции server-side для будущего flow проверки карточек;
- не возвращают клиенту SQL/provider details.

`get-vocabulary-review-state`:
- валидирует Telegram `initData`;
- вызывает server-only RPC для точного snapshot очереди;
- не принимает `user_id` и дату от клиента.

`review-vocabulary-word`:
- валидирует Telegram `initData`, `wordId` и фиксированный action;
- применяет переход через server-only RPC;
- не разрешает менять чужую, неготовую или `learned`-карточку.

`dev-tools`:
- валидирует Telegram `initData`
- работает только при server env `DEV_TOOLS_ENABLED="true"`
- требует `users.app_role = 'admin'`
- выполняет фиксированный список локальных dev-действий для текущего Telegram-пользователя
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
- проверяет наличие active text для даты завершения
- пишет дневной completion-marker для progress/streak
- копирует active text в историю завершенных текстов отдельной записью
- удаляет active text
- заполняет `users.first_text_completed_at` для онбординга

`public.activate_mvp_subscription(...)`:
- берет advisory lock по пользователю
- проверяет active и scheduled подписки
- создает `monthly` или `yearly` подписку в одной транзакции
- планирует `yearly` после active `monthly`, если такой переход доступен

`public.save_pending_vocabulary_word_with_source(...)`:
- берет advisory lock по пользователю;
- проверяет существующую карточку и лимит только перед новой вставкой;
- атомарно сохраняет pending-слово и source;
- реактивирует существующее `learned`-слово без увеличения размера словаря.

`public.claim_vocabulary_card_generation_attempt(...)`:
- берет advisory lock по пользователю и дате;
- атомарно проверяет дневной лимит и создает metadata попытки.

`public.review_vocabulary_word(...)`:
- берет advisory lock по пользователю и дате и row lock выбранной карточки;
- применяет только allowlist-действия алгоритма;
- обновляет шаг, следующую дату и счетчики;
- фиксирует completion-marker после последней обязательной карточки.

`public.dev_complete_vocabulary_reviews_at_step(...)`:
- доступен только `service_role`;
- берет advisory lock по пользователю и дате;
- переносит обязательную очередь текущего дня на allowlist-шаг;
- фиксирует completion-marker повторения за текущую дату.

`public.get_or_create_vocabulary_review_state(...)`:
- использует тот же advisory lock повторения;
- считает очередь и следующую карточку server-side без клиентского лимита;
- возвращает отдельные счетчики для обязательного плана и отображения экрана повторения;
- фиксирует completion-marker, когда обязательная очередь пуста;
- доступен только `service_role`.
