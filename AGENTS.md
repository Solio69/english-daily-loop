# AGENTS.md

## Назначение

Этот файл фиксирует правила работы AI-агентов в репозитории, чтобы процесс был предсказуемым, безопасным и удобным для владельца проекта.

## Контекст проекта

- Проект: `english-daily-loop`.
- Текущий стек: Vite + React + TypeScript.
- Пакетный менеджер: `pnpm`.
- Текущая формальная версия приложения хранится в `package.json`; release artifacts проверяются read-only командой `pnpm release:check`.
- Целевой продукт: Telegram Mini App.
- Вектор по данным: Supabase (Postgres).
- Локальная инфраструктура уже настроена: Docker + WSL + Supabase local.
- Локальный Telegram-запуск: `npm run dev:telegram` (отдельный dev-бот + изолированный `.env.telegram.local` + Supabase local + Edge Functions + API/frontend Quick Tunnels с ожиданием публикации URL + автообновление локальных `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` + frontend build/watch в `dist-telegram` + Vite preview + live-логи DB/API + startup summary). Команда не читает и не изменяет `.env.local` или production secrets; обычный production build использует отдельную папку `dist`.
- Локальные Supabase-порты: API `54321`, DB `54322`, Studio `54323`, Mailpit `54324`, Analytics `54327`, Pooler `54329`; tunnels используют `127.0.0.1`, чтобы не зависеть от IPv6-резолва `localhost` на Windows.
- Отдельного backend-сервера (Express) сейчас нет; backend-слой представлен Supabase API + Edge Functions.
- Папка `tools/` используется для локальных утилит запуска (например, `cloudflared.exe`) и не коммитится.

## Документация для агентов

- Актуальная дизайн-система: `docs/agents/DESIGN_SYSTEM.md`.
- Общие правила подробного ручного тестирования фич и баг-пачек: `docs/agents/references/manual-testing-guide.md`.
- Подробности локального Telegram-запуска: `docs/agents/LOCAL_TELEGRAM_RUN.md`.
- Шаблон локального Telegram env: `.env.telegram.example`; inventory production env: `.env.production.example` и `notes/production-env.md`.
- Project-local skill sources лежат в `docs/agents/skills`; они не устанавливаются автоматически в `~/.codex/skills`.
- Для разбора пользовательских отчетов об ошибках использовать skill source `docs/agents/skills/english-daily-loop-support-triage`.
- Для pre-code разбора сырых багов и формирования согласуемых баг-пачек использовать skill source `docs/agents/skills/triage-english-daily-loop-bugs`.
- Для grooming новых фич и создания согласуемых feature draft использовать skill source `docs/agents/skills/english-daily-loop-feature-spec`; канонические draft-файлы создаются в `D:\anastasiaStorage\pet-projects\English daily loop\Фичи`, а подробный ручной checklist является обязательной частью спецификации.
- Рабочая папка проекта `D:\anastasiaStorage\pet-projects\English daily loop` доступна кодинг-агенту для чтения и редактирования документации.

## Роль кодинг-агента и допуск к реализации

- Кодинг-агент занимается реализацией спецификаций, подготовленных другим агентом.
- Перед изменением кода кодинг-агент обязан полностью прочитать спецификацию и сверить ее с актуальными кодом, документацией и Git HEAD.
- Переход к реализации разрешен только для готовой и согласованной спецификации, в которой нет противоречий, открытых продуктовых или технических решений, непонятных шагов и отсутствующих обязательных acceptance criteria.
- Если готовность спецификации нельзя подтвердить, кодинг-агент не меняет код, перечисляет найденные вопросы или противоречия и запрашивает решение владельца.
- Без согласованной спецификации код не изменяется, кроме случая, когда владелец явно просит выполнить конкретное изменение без отдельной спецификации.
- Если в процессе реализации обнаруживается необходимость изменить согласованный scope, поведение, дизайн, миграцию, модель данных, auth, RLS или grants, кодинг-агент останавливается и запрашивает решение до продолжения.
- Документация и спецификации описывают актуальное состояние проекта. В них не используются формулировки истории изменений в стиле `было → стало`, если отдельный changelog явно не запрошен.

## Правила коммуникации

- По умолчанию объяснять на русском языке.
- Каждую команду объяснять перед запуском: что она делает и зачем.
- В режимах настройки и отладки с пользователем давать по одной команде за шаг.
- После шага ждать вывод/скриншот пользователя и только потом двигаться дальше.
- Тон: поддерживающий, без оценочности и давления.
- Предпочитать короткие и практичные инструкции вместо длинной теории.
- После изменений кода проводить pre-commit review всего затронутого scope, перечислять найденные риски и предлагать улучшения кода проекта с кратким объяснением пользы каждого улучшения.
- После изменений кода сообщать владельцу следующие действия и необходимые команды в правильном порядке, объяснять назначение каждого шага; если дополнительных действий нет, явно писать об этом.
- После изменений кода предлагать одно подходящее название коммита на английском для всего scope:
  - `fix: ...` — исправление бага;
  - `feat: ...` — новый пользовательский или технический функционал;
  - `refactor: ...` — улучшение существующей реализации без нового поведения;
  - `tech: ...` — изменение конфигурации или технической инфраструктуры;
  - `chore: ...` — вспомогательная или нерегулярная работа.

## Правила принятия решений

- Не спешить с реализацией, пока архитектурный выбор не согласован.
- Для решений с компромиссами (стоимость, безопасность, lock-in) кратко показывать варианты.
- Предпочитать маленькие итеративные изменения вместо крупных рефакторингов.
- Перед изменениями с неочевидными последствиями явно подтверждать направление.

### Согласованные баг-пачки

- Внешняя база багов находится в `D:\anastasiaStorage\pet-projects\English daily loop\Баги`; pre-code workflow оркестратора описан skill source `docs/agents/skills/triage-english-daily-loop-bugs`.
- Статус пачки `готово к разработке` означает, что продуктовый scope, ожидаемое поведение, acceptance criteria и ручные проверки явно согласованы владельцем.
- Перед реализацией кодинг-агент обязан сверить пачку с актуальными кодом, документацией и Git HEAD, поставить статус `в разработке`, дополнить ее техническим планом и затем выполнять этот план без отдельного согласования.
- После реализации и автоматических проверок кодинг-агент ставит пачке статус `готово к ручной проверке`; checklist отмечает и статус `проверено` ставит только владелец.
- Кодинг-агент должен остановиться и запросить решение, если реализация меняет согласованный scope или поведение, требует несогласованного дизайна, несогласованной миграции или изменения данных БД, затрагивает auth/RLS/grants сверх согласованной задачи, требует действий с секретами либо обнаруживает настоящий технический блокер.
- Это исключение не отменяет запреты на применение миграций, изменение данных БД, установку сторонних пакетов и изменяющие Git-команды.
- Для новых фич и несогласованных улучшений сохраняется обычный flow: обсуждение, продуктовые решения, пошаговый план и явное разрешение на реализацию.

## Технический вектор (по умолчанию)

- Для MVP сначала использовать Supabase.
- Изолировать доступ к данным в сервисном слое, чтобы позже можно было перейти на обычный Postgres.
- Не смешивать бизнес-логику и UI-компоненты без необходимости.
- Общие доменные типы держать в `src/types`.

## Ограничения Telegram Mini App

- Использовать `telegram_user_id` как стабильный идентификатор пользователя.
- Проверку `Telegram initData` выполнять только на серверной стороне.
- Не хранить и не использовать чувствительные ключи в клиентском коде.

## Правила безопасности

- Никогда не коммитить реальные ключи, токены и секреты.
- Общие локальные секреты хранить в gitignored env-файлах, а требования документировать в соответствующих `*.example`; `dev:telegram` использует только `.env.telegram.local`, создаваемый из `.env.telegram.example`.
- `SUPABASE_SERVICE_ROLE_KEY` использовать только на сервере.
- `OPENROUTER_API_KEY` использовать только на сервере, через Supabase Edge Functions.
- `TELEGRAM_BOT_TOKEN` использовать только на сервере, через Supabase Edge Functions.
- Не ослаблять контроль доступа ради скорости разработки.
- Агенту запрещено применять миграции и самостоятельно выполнять команды, изменяющие данные даже в локальной БД; необходимые локальные команды передаются владельцу с объяснением ожидаемого результата.
- Агенту запрещено выполнять и предлагать владельцу команды, которые могут изменить production БД, включая production-миграции, DDL, DML, reset, seed и административные операции.
- Если задача или обсуждение относится к production БД, агент обязан явно сообщить владельцу: `Мы работаем с production БД`, и ограничить работу безопасным анализом, кодом миграции или документацией без выполнения и передачи изменяющих production-команд.

## Правила внесения изменений

- Сохранять текущую структуру и стиль проекта, если явный рефакторинг не запрошен.
- Делать небольшие, проверяемые изменения.
- Не использовать разрушительные git/file операции без явного запроса.
- После существенных изменений запускать проверки (минимум `pnpm lint`) и сообщать результат.
- Для изменений повторения, навигации и общих frontend helpers запускать `pnpm test`.

## Жесткая Git-политика

- Агенту запрещены любые команды, меняющие историю или состояние репозитория: `git commit`, `git push`, `git merge`, `git rebase`, `git cherry-pick`, `git reset`, `git revert`, `git tag`, `git stash`, `git checkout` (для переключения/отката), `git switch`, `git restore`, `git clean`.
- Агент может использовать Git только в режиме чтения: `git status`, `git log`, `git diff`, `git show`, `git blame`, `git branch --show-current`, `git rev-parse`.
- Это строгое правило без исключений, пока пользователь явно не изменит политику в репозитории.
- Детальная формулировка вынесена в отдельный файл: `GIT_POLICY.md`.

## Текущий статус (для будущих агентов)

- Supabase local и Docker-окружение уже работают.
- Уже подключены и используются таблицы `public.users`, `public.user_settings`, `public.reading_texts`, `public.reading_generation_attempts`, `public.user_active_reading_texts`, `public.user_daily_reading_completions`, `public.user_completed_reading_texts`, `public.user_subscriptions`, `public.user_vocabulary_words`, `public.user_vocabulary_word_sources`, `public.vocabulary_card_generation_attempts`, `public.user_daily_vocabulary_review_completions` и `public.support_reports`.
- В `public.user_settings` есть настройки `english_level`, `daily_reading_minutes`.
- На пользовательских, reading-state, completion/history и subscription таблицах включен RLS; frontend не пишет в защищенные таблицы напрямую, операции проходят через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.
- Миграция `supabase/migrations/20260430120000_harden_public_api_permissions.sql` явно закрывает прямой доступ `anon`/`authenticated` к защищенным таблицам, закрывает legacy RPC `get_random_reading_text` для клиента и оставляет server-only доступ через `service_role`.
- Миграция `supabase/migrations/20260430173000_add_ai_generation_observability.sql` добавляет безопасные metadata-поля AI-попыток в `public.reading_generation_attempts`: prompt version, model chain, target/validation ranges, output word count, fallback flag, duration и failure stage.
- Миграция `supabase/migrations/20260430190000_schedule_ai_attempt_cleanup.sql` включает `pg_cron` и создает scheduled cleanup job `cleanup_ai_generation_attempts` для удаления AI attempt metadata старше `90` дней.
- Миграция `supabase/migrations/20260528120000_add_vocabulary_card_generation_attempts.sql` добавляет `public.vocabulary_card_generation_attempts`, RPC `claim_vocabulary_card_generation_attempt(...)` и scheduled cleanup job `cleanup_vocabulary_card_generation_attempts` для удаления attempt metadata подготовки карточек старше `90` дней.
- Миграция `supabase/migrations/20260618120000_add_vocabulary_review_flow.sql` добавляет статусы и поля повторения, таблицу дневных completion-marker и RPC `review_vocabulary_word(...)`.
- Миграция `supabase/migrations/20260622120000_harden_vocabulary_review_state.sql` добавляет RPC `get_or_create_vocabulary_review_state(...)` для атомарного snapshot очереди и фиксирует реактивацию существующих `learned`-слов без увеличения словаря.
- Миграция `supabase/migrations/20260626120000_add_dev_vocabulary_review_batch_step.sql` добавляет server-only RPC `dev_complete_vocabulary_reviews_at_step(...)` для локального переноса всей очереди повторения на выбранный шаг.
- Миграция `supabase/migrations/20260626130000_add_vocabulary_review_display_counts.sql` добавляет display-счетчики повторения для экрана `Слова`, не меняя семантику обязательного дневного плана для главной.
- Миграция `supabase/migrations/20260701120000_scope_active_reading_text_by_date.sql` добавляет `reading_date` в `public.user_active_reading_texts`, ограничивает active text текущей московской датой и обновляет RPC завершения чтения/сохранения словаря.
- Миграция `supabase/migrations/20260705130000_promote_vocabulary_needs_approval_cards.sql` переводит существующие `needs_approval`-карточки в текущий `ready` + `not_started` flow повторения.
- Миграция `supabase/migrations/20260706120000_add_user_app_roles.sql` добавляет `users.app_role` со значениями `admin | tester | user`; новые пользователи по умолчанию получают роль `tester`.
- Миграция `supabase/migrations/20260707120000_add_support_reports.sql` добавляет `public.support_reports` для пользовательских отчетов об ошибках, закрывает таблицу для `anon`/`authenticated` и создает scheduled cleanup job `cleanup_support_reports` для удаления отчетов старше `30` дней.
- Миграция `supabase/migrations/20260723120000_add_moscow_study_day_and_carry_active_text.sql` добавляет server-only SQL-helper учебной даты с границей `05:00 Europe/Moscow`, снимает date-scope с единственного active text и обновляет reading/review RPC без переписывания исторических данных; timestamp-чувствительные mutation RPC получают дату из того же DB timestamp, который сохраняют.
- Миграция `supabase/migrations/20260724120000_add_active_reading_position.sql` добавляет nullable-позицию абзаца `last_read_paragraph_index` в единственный active text; `null` означает абсолютный верх страницы.
- В проекте есть базовые миграции и сиды для локальной разработки (dev user + моковые тексты).
- Миграция `supabase/migrations/20260424113000_drop_daily_review_words_from_user_settings.sql` удаляет устаревшее поле `daily_review_words` из `public.user_settings`.
- Миграция `supabase/migrations/20260513120000_drop_daily_exercise_minutes_from_user_settings.sql` удаляет поле `daily_exercise_minutes` из `public.user_settings`.
- Миграция `supabase/migrations/20260427165000_enable_rls_for_users_and_settings.sql` включает RLS для `public.users` и `public.user_settings`.
- Серверные транзакционные операции вынесены в Postgres RPC:
  - `public.claim_reading_generation_attempt(...)` — атомарная проверка лимита и списание попытки генерации
  - `public.get_moscow_study_date(...)` — server-only расчет учебной даты с границей `05:00 Europe/Moscow`; timestamp-чувствительные mutation RPC используют его с единым DB timestamp.
  - `public.complete_daily_reading_text(...)` — завершение единственного active text независимо от даты генерации, атомарная фиксация DB timestamp и соответствующей учебной даты, удаление active text и онбординг-флаг
  - `public.activate_mvp_subscription(...)` — активация MVP-подписки с advisory lock по пользователю.
  - `public.save_pending_vocabulary_word_with_source(...)` — атомарное сохранение pending-слова и source из актуального active text независимо от даты генерации с advisory lock по пользователю.
  - `public.claim_vocabulary_card_generation_attempt(...)` — атомарная проверка лимита и списание попытки подготовки словарных карточек.
  - `public.review_vocabulary_word(...)` — атомарный переход по шкале повторения и создание дневного completion-marker на учебную дату того же DB timestamp, который сохраняется в `last_reviewed_at`.
  - `public.get_or_create_vocabulary_review_state(...)` — точный snapshot очереди и фиксация завершения пустого плана с advisory lock по пользователю и дате.
  - `public.dev_complete_vocabulary_reviews_at_step(...)` — local dev-only перенос обязательной очереди повторения на абсолютный шаг с созданием дневного completion-marker.
- Корневой `tsconfig.json` исключает `supabase/functions`, потому что Edge Functions работают в Deno-рантайме и не должны проверяться frontend `tsc`.
- Общая server-инфраструктура Edge Functions находится в `supabase/functions/_shared/server.ts`: CORS, POST guard, JSON parsing, env helpers, Telegram `initData` validation, request id, безопасные JSON-ответы и `AppError`; общий helper safe AI diagnostics находится в `supabase/functions/_shared/ai-diagnostics.ts`.
- Общая server-логика ролей, effective subscription summary и лимитов доступа находится в `supabase/functions/_shared/access.ts`; лимит, подсчет и обновление metadata попыток подготовки словарных карточек находятся в `supabase/functions/_shared/vocabulary-card-generation.ts`.
- Общий helper московской учебной даты с границей `05:00` находится в `supabase/functions/_shared/moscow-study-date.ts`; правила server-side разбиения текста на абзацы — в `supabase/functions/_shared/reading-text.ts`; server helper'ы повторения, home progress, streak и счетчика истории находятся в `supabase/functions/_shared/vocabulary-review.ts`, `supabase/functions/_shared/vocabulary-review-state.ts`, `supabase/functions/_shared/home-progress.ts`, `supabase/functions/_shared/reading-streak.ts` и `supabase/functions/_shared/reading-history.ts`; best-effort расчет производных метрик после завершения чтения оркестрирует `supabase/functions/_shared/reading-completion-metrics.ts`.
- Edge Functions `auth-telegram`, `save-user-settings`, `activate-subscription`, `complete-reading-text`, `dev-tools`, `get-reading-state`, `get-reading-history`, `generate-reading-text`, `save-reading-position`, `save-vocabulary-word`, `get-vocabulary-state`, `get-vocabulary-words`, `get-vocabulary-review-state`, `review-vocabulary-word`, `prepare-vocabulary-cards`, `approve-vocabulary-card`, `approve-vocabulary-cards` и `submit-support-report` используют общий helper для Telegram auth/error/env/http слоя; бизнес-валидация остается внутри конкретных функций.
- Telegram auth реализована через Edge Function `supabase/functions/auth-telegram/index.ts`:
  - серверная валидация `initData` (подпись + `auth_date`)
  - идемпотентный `find-or-create/upsert` пользователя по `telegram_user_id`
  - ошибки Telegram validation возвращаются как `401 AUTH_VALIDATION_FAILED`, а внутренние DB/server ошибки как отдельные `5xx` коды
  - неожиданные внутренние ошибки возвращаются клиенту с безопасным сообщением без SQL/provider details, подробности остаются в server logs
  - возвращает `settings`, если `settings_completed_at` уже заполнен
  - возвращает `role` и `subscription` summary (`tier`, `accessType`, `limits`, активная/запланированная подписка)
  - возвращает `homeProgress.lesson` (`status`, `currentStep`) для карточки урока на главной
  - возвращает `homeProgress.reading.status` (`not_started | in_progress | completed`) для карточки дневного прогресса
  - возвращает `homeProgress.review` (`status`, `dueCount`, `reviewedTodayCount`) для шага повторения
  - возвращает `streakDays` для счетчика с иконкой огонька
  - возвращает nullable `completedReadingTextCount` как общее количество завершенных текстов пользователя; временная ошибка агрегатного запроса не блокирует bootstrap
  - единый контракт ответа (`ok/data` или `ok/error`).
- Сохранение настроек пользователя реализовано через Edge Function `supabase/functions/save-user-settings/index.ts`:
  - серверная валидация `Telegram initData`
  - валидация `english_level`, `daily_reading_minutes`
  - upsert в `public.user_settings`
  - заполнение `users.settings_completed_at`, если настройки сохраняются впервые
  - возврат актуальных `settings`, `subscription` и `homeProgress`; текущие `streakDays` и `completedReadingTextCount` сохраняются клиентом при обновлении профиля.
- Роли приложения хранятся в `public.users.app_role`: `admin`, `tester`, `user`. `admin` и `tester` получают internal paid-like доступ без строки в `user_subscriptions`; `admin` дополнительно может использовать dev tools при включенном server env `DEV_TOOLS_ENABLED`.
- MVP-подписки реализованы через таблицу `public.user_subscriptions`:
  - `plan_type`: `monthly` или `yearly`
  - `starts_at` / `ends_at` хранятся как `timestamptz`
  - активность подписки вычисляется сервером по интервалу `starts_at <= now < ends_at`
  - `monthly` действует 1 день, `yearly` действует 7 дней от момента оформления
  - `source = 'mvp_zero_price'`, реальные платежи пока не подключены.
- Пользовательский flow подписки скрыт через `SHOW_SUBSCRIPTION_FLOW = false`; `SubscriptionScreen`, `subscriptionService` и Edge Function `supabase/functions/activate-subscription/index.ts` сохранены для будущего платежного flow:
  - обязательный server env gate `SUBSCRIPTION_FLOW_ENABLED="true"`
  - серверная валидация `Telegram initData`
  - поиск пользователя по `telegram_user_id`
  - транзакционная активация через RPC `activate_mvp_subscription`
  - создание подписки за 0 рублей
  - если активна monthly, можно запланировать yearly с началом после окончания monthly
  - если активна yearly, действия оформления пока блокируются.
- Генерация текста реализована через Edge Function `supabase/functions/generate-reading-text/index.ts`:
  - серверная валидация `Telegram initData`
  - поиск пользователя по `telegram_user_id`
  - чтение `english_level` и `daily_reading_minutes` из `user_settings`
  - атомарная проверка дневного лимита и списание попытки через RPC `claim_reading_generation_attempt`
  - prompt/output слой находится в `supabase/functions/generate-reading-text/ai-pipeline.ts`
  - общий OpenRouter client/model allowlist находится в `supabase/functions/_shared/openrouter.ts`
  - общие AI text helpers находятся в `supabase/functions/_shared/ai-text.ts`
  - текущий prompt version: `reading-text-v1`
  - OpenRouter model chain проходит server-side allowlist до списания попытки
  - генерация через OpenRouter `models` parameter с allowlist-цепочкой free-моделей
  - запрос требует `response_format = json_object` и ограничивает reasoning через `reasoning = { effort: "low", exclude: true }`; пустой provider response исключает фактически ответившую модель и запускает следующий маршрут
  - provider diagnostics логируют только безопасные metadata (`model`, `finish_reason`, HTTP status/error code, completion/reasoning token counts), без raw content и reasoning text
  - ошибка генерации может вернуть safe diagnostics с `requestId`, prompt version, model chain, stage, target/validation ranges, duration и sanitized provider/validation error для пользовательского отчета
  - динамический `max_tokens` и диапазон слов по времени чтения
  - output validation проверяет JSON, title/body, `estimatedMinutes`, `level`, длину с допуском примерно `±20%` и базовые content-safety patterns
  - observability AI-попыток хранится в `reading_generation_attempts` как metadata без полного prompt, raw provider response, полного generated text, Telegram `initData`, secrets и stack trace
  - timeout одного запроса к OpenRouter: `25` секунд, общий budget генерации текста: `90` секунд
  - сохранение последнего успешного непрочитанного текста в `user_active_reading_texts` с `reading_date` текущей учебной даты и явным reset позиции в `null`; предыдущий active text заменяется только после валидного AI-ответа
  - единый контракт ответа (`ok/data` или `ok/error`).
- Состояние экрана чтения реализовано через Edge Function `supabase/functions/get-reading-state/index.ts`:
  - серверная валидация `Telegram initData`
  - учебная дата начинается в `05:00` по timezone `Europe/Moscow`
  - возвращает единственный активный текст пользователя независимо от даты генерации, дневной лимит, использованные/оставшиеся попытки текущей учебной даты и флаг `isReadingCompletedToday`.
- Позиция чтения сохраняется через Edge Function `supabase/functions/save-reading-position/index.ts`:
  - сервер валидирует Telegram `initData`, определяет пользователя и сверяет точный `reading_text_id` его active text
  - принимает только существующий неотрицательный индекс абзаца либо `null` для абсолютного верха
  - frontend сохраняет позицию после debounce, сериализует запросы, делает одну короткую повторную попытку и не блокирует чтение при ошибке
  - круглая кнопка наверх прокручивает `window` к `top = 0` и записывает server-side `null`, не подменяя reset индексом первого абзаца.
- Завершение чтения реализовано через Edge Function `supabase/functions/complete-reading-text/index.ts`:
  - серверная валидация `Telegram initData`
  - транзакционное завершение единственного активного текста независимо от даты генерации через RPC `complete_daily_reading_text`
  - запись дневного completion-marker в `user_daily_reading_completions` для progress/streak
  - сохранение отдельного snapshot прочитанного текста в `user_completed_reading_texts`
  - удаление завершенного активного непрочитанного текста из `user_active_reading_texts`
  - заполнение `users.first_text_completed_at` только для онбординга, если это первый прочитанный текст пользователя.
  - best-effort пересчет `streakDays` как серии подряд идущих дней по `user_daily_reading_completions`.
  - best-effort возврат `completedReadingTextCount` после сохранения snapshot; сбой производных метрик не меняет успешный результат уже выполненного RPC.
- История прочитанных текстов реализована через Edge Function `supabase/functions/get-reading-history/index.ts`:
  - серверная валидация `Telegram initData`
  - чтение завершенных текстов текущего пользователя из `user_completed_reading_texts`
  - cursor-пагинация через `limit` и `cursor`
  - единый контракт ответа (`ok/data` или `ok/error`).
- Технические dev tools реализованы через Edge Function `supabase/functions/dev-tools/index.ts`:
  - серверная валидация `Telegram initData`
  - обязательный server env gate `DEV_TOOLS_ENABLED="true"`
  - обязательная server-side роль `users.app_role = 'admin'`
  - actions: `reset_generation_attempts`, `reset_vocabulary_card_attempts`, `reset_vocabulary_review_progress`, `make_vocabulary_reviews_due_today`, `complete_today_vocabulary_reviews_at_step`, `clear_today_vocabulary_review_completion`, `delete_today_reading_completion`, `reset_subscriptions`
  - `complete_today_vocabulary_reviews_at_step` принимает `reviewStep` и переносит все обязательные карточки текущего дня на выбранный абсолютный шаг через RPC `dev_complete_vocabulary_reviews_at_step`
  - `delete_today_reading_completion` удаляет дневной progress-marker и все завершенные сегодня тексты текущего пользователя
  - frontend-панель показывается только при роли `admin`.
- Пользовательские отчеты об ошибках реализованы через Edge Function `supabase/functions/submit-support-report/index.ts`:
  - серверная валидация `Telegram initData`
  - rate limit: `5` отчетов на пользователя в час
  - максимальный diagnostic snapshot: `100KB`; при превышении сервер отбрасывает старые client events
  - сохраняет только sanitized данные в `public.support_reports`: комментарий, текущий экран, app context, последние client events, request ids и safe AI diagnostics
  - не сохраняет Telegram `initData`, токены, secrets, prompt, raw AI response, полный generated text и stack trace
  - отчеты очищаются через `pg_cron` после `30` дней.
- Текущие MVP-лимиты подписок:
  - free: `3` генерации текста в день, словарь до `30` слов
  - paid: `10` генераций текста в день, словарь до `300` слов.
- Роли `admin` и `tester` получают paid-like лимиты через `accessType = internal`, даже если активной строки в `user_subscriptions` нет.
- Текущие MVP-лимиты подготовки AI-карточек словаря:
  - free: `5` batch-попыток в день
  - paid: `20` batch-попыток в день
  - 1 попытка = 1 запрос `prepare-vocabulary-cards` для batch до `5` pending-слов; если pending-слов нет, попытка не списывается, AI/provider/validation ошибка попытку списывает.
- Дневной лимит генерации считается только на сервере в Edge Functions чтения по effective access (`admin/tester` internal access или активная подписка из `user_subscriptions`); фронт только отображает полученные `dailyLimit/remainingAttempts`.
- Текущая дефолтная OpenRouter-цепочка для генерации текста:
  - `qwen/qwen3-next-80b-a3b-instruct:free`
  - `nvidia/nemotron-nano-9b-v2:free`
  - `google/gemma-4-31b-it:free`
  - `google/gemma-4-26b-a4b-it:free`
  - `openai/gpt-oss-20b:free`.
- Требуемые server env для AI:
  - `OPENROUTER_API_KEY`
  - опционально `OPENROUTER_MODEL_CHAIN`
  - опционально `OPENROUTER_MODEL_PRIMARY`
  - опционально `OPENROUTER_MODEL_FALLBACK`
  - опционально `OPENROUTER_MODEL_TERTIARY`.
- `OPENROUTER_MODEL_CHAIN` задает полный порядок моделей для генерации текста; `OPENROUTER_MODEL_PRIMARY/FALLBACK/TERTIARY` используются как дополнительные модели после дефолтной цепочки, если `OPENROUTER_MODEL_CHAIN` не задан.
- Для стабильной DX в редакторе: у функции используется `// @ts-nocheck`, а для Deno-окружения есть `supabase/functions/deno.json` и `supabase/functions/deno-globals.d.ts`.
- На фронте подключен Telegram WebApp SDK (`index.html`) и типы `window.Telegram.WebApp` (`src/types/telegram-webapp.d.ts`).
- UI-слой использует Tailwind CSS 4 через Vite plugin, дизайн-токены в `src/index.css`, локальные шрифты `@fontsource/inter` и `@fontsource/manrope`, иконки `lucide-react`.
- Общие UI primitives находятся в `src/components`: `ScreenHeader` для внутренних экранов с back navigation, `LoadingState` для glass-загрузок, `InlineStatusCard` для встроенных статусов и `Button` для CTA/control кнопок.
- Базовый `Layout` сделан full-bleed под Telegram Mini App: без внешнего app shell, с `100dvh`, CSS-переменными темы и фиксированной нижней навигацией.
- Тема приложения управляется через `src/context/ThemeContext.tsx`: preference `system | light | dark` хранится в `localStorage`, дефолт `system` берет тему из `Telegram.WebApp.colorScheme`, а вне Telegram использует `prefers-color-scheme`; `index.html` содержит ранний theme bootstrap, чтобы выставить `.dark` до React-рендера.
- App-level состояние профиля, toast и пользовательские действия вынесены в hooks: `useAppUserProfile`, `useToast`, `useAppUserActions`; `App` остается composition root для навигации и сборки экранов.
- Главная страница реализована как compact mobile-first экран: header с приветствием, трехпозиционным переключателем темы, теплой кнопкой настроек, карточкой дневного прогресса `Текст` + `Повторение` со streak, карточкой плана на сегодня и карточкой `Мои материалы`; entry подписки скрыт, пока `SHOW_SUBSCRIPTION_FLOW = false`.
- Нижняя навигация содержит 4 пункта: `Главная`, `Текст`, `Слова`, `Материалы`; пункт `Материалы` открывает экран `Мои материалы` и подсвечивается на этом экране.
- Bootstrap пользователя в `src/services/userService.ts` авторизуется через `auth-telegram` по Telegram `initData`; `AppUser` содержит `role`, `subscription`, `homeProgress`, `streakDays` и nullable `completedReadingTextCount`.
- Общий frontend helper Edge Function вызовов находится в `src/services/functionClient.ts`; модель ошибок, request id и diagnostic extraction вынесены в `src/services/edgeFunctionErrors.ts`, а последние клиентские события собираются в `src/services/clientLogger.ts`.
- Client fallback подписки находится в `src/constants/subscriptionFallbacks.ts` и используется только как страховка bootstrap; source of truth для ролей, лимитов и подписок остается в Edge Functions.
- `src/services/userService.ts` сохраняет настройки через `save-user-settings`; прямых записей в `users` и `user_settings` с клиента нет.
- На фронте подписка вынесена в `src/services/subscriptionService.ts` и `src/screens/SubscriptionScreen.tsx`, но пользовательский вход скрыт через `src/constants/subscriptionFeatures.ts`; клиент вызывает только `activate-subscription`, прямых записей подписки в БД с фронта нет.
- Логика чтения вынесена в сервисный слой (`src/services/readingService.ts`), UI-компонент не содержит прямых запросов к БД.
- `readingService` вызывает `get-reading-state`, `generate-reading-text` и `complete-reading-text`; текущий UI генерации не использует прямой RPC fallback `get_random_reading_text`.
- Экран `Текст` реализован как контейнер `src/screens/ReadingScreen.tsx` плюс презентационные компоненты `src/components/reading/*`; idle, active text, loading, error и completed состояния используют mobile-first glass UI.
- Парсинг отображаемого текста и нормализация кликабельных слов вынесены в `src/utils/readingText.ts`; `wordIndex` используется flow сохранения словаря и должен оставаться стабильным для selectable words.
- `materialsService` вызывает `get-reading-history`; экран `Мои материалы` показывает завершенные тексты с табами `Тексты` и `Словарь`, где доступны подготовка и просмотр карточек словаря.
- UI словаря в `Мои материалы` использует `src/components/vocabulary/*`: summary-карточку состояния словаря с compact status card `Добавить`, где активное значение использует warm-состояние, а нулевое значение показывает blue ready-state `Все готовы` с иконкой `Layers`; fixed-height action `Готовить` для pending-слов, compact info panel, compact list rows, раскрываемые карточки с деталями/примерами/actions и `InlineStatusCard` для встроенных ошибок.
- Редактирование словарных карточек не доступно в пользовательском UI; заготовка action-кнопки скрыта в `src/components/vocabulary/VocabularyWordActions.tsx` через TODO-флаг до реализации полного flow редактирования.
- Подтверждение AI-карточек не доступно в пользовательском UI; заготовка approval-flow скрыта через TODO-флаг `SHOW_VOCABULARY_CARD_APPROVAL_FLOW` до реализации проверки/редактирования карточек.
- Ошибки подготовки словарных карточек показываются внутри summary-карточки под action `Готовить` и над compact info panel; ошибки загрузки и просмотра словаря остаются встроенными статусами через `InlineStatusCard`.
- Сохранение словаря реализовано через `public.user_vocabulary_words`, `public.user_vocabulary_word_sources` и Edge Function `save-vocabulary-word`: слово добавляется только из актуального active text пользователя с проверкой `reading_text_id`, независимо от даты генерации, без AI и сохраняется как `not_started` + `card_status = pending`.
- Карточки слов готовятся отдельно в табе `Словарь` через Edge Function `prepare-vocabulary-cards`, batch-ом до `5` pending-слов за запрос; перед AI-запросом сервер списывает попытку через RPC `claim_vocabulary_card_generation_attempt`; валидные AI-карточки получают `card_status = ready` и `status = not_started`, а слова без валидной карточки остаются в `pending`.
- Если AI приводит pending-слово к канонической форме, которая уже есть у пользователя, подготовка карточек переносит `user_vocabulary_word_sources` и удаляет pending-дубликат; прогресс `active`-слова сохраняется, а `learned`-слово возвращается в `not_started`.
- Prompt/output слой подготовки словарных карточек находится в `supabase/functions/prepare-vocabulary-cards/ai-pipeline.ts`; сохранение подготовленных карточек и merge pending-дубликатов находятся в `supabase/functions/prepare-vocabulary-cards/card-persistence.ts`; общий OpenRouter client/model allowlist переиспользуется из `supabase/functions/_shared/openrouter.ts`.
- Edge Functions `approve-vocabulary-card` и `approve-vocabulary-cards` остаются server-side заделом для будущего flow проверки карточек; текущий пользовательский UI их не показывает.
- `ready`-карточка сразу доступна в очереди повторения текущего дня.
- Экран `Слова` реализует дневное повторение через `get-vocabulary-review-state` и `review-vocabulary-word`; очередь сортируется как новые → просроченные → сегодняшние, дневного cap нет.
- Состояния учебного прогресса слова: `not_started | active | learned`; шкала интервалов: `1 день`, `3 дня`, `7 дней`, `14 дней`, `1–6 месяцев`, затем `learned`.
- Завершение обязательной очереди фиксируется в `user_daily_vocabulary_review_completions`; новые карточки после completion доступны дополнительно и не открывают завершенный план заново.
- `get-vocabulary-review-state` возвращает `required*`-счетчики для обязательного плана и `display*`-счетчики для экрана `Слова`; если completion-marker уже есть, главная остается завершенной, а экран повторения показывает дополнительные новые карточки в общем прогрессе.
- Для связи слов с текстами активные и завершенные тексты имеют стабильный `reading_text_id`; active text также хранит `reading_date` генерации и nullable-индекс последнего абзаца, бессрочно переносится между учебными днями, а при завершении чтения RPC `complete_daily_reading_text` переносит этот id из `user_active_reading_texts` в `user_completed_reading_texts`.
- Сохранение pending-слова выполняется через RPC `save_pending_vocabulary_word_with_source` с advisory lock по пользователю и проверкой владельца/актуального `reading_text_id` без date-фильтра; лимит словаря проверяется server-side по effective access (`free: 30`, `paid/internal: 300`), прямых записей словаря с клиента нет.
- AI-карточка слова хранит базовую форму, перевод, часть речи, данные глагола при необходимости и 3 английских примера по уровню пользователя; подготовка карточек сохраняет валидную часть batch-а, мержит совпадения по канонической форме, не блокирует карточку только из-за некорректного echo-поля `level` от AI и оставляет слова с невалидным или отсутствующим AI-ответом в `pending`.
- На главной есть компактная карточка `Мои материалы`; пункт нижней навигации `Материалы` открывает экран материалов, плитка `Тексты` открывает таб текстов и показывает `Прочитано: N текст/текста/текстов` либо `История чтения`, если счетчик временно недоступен; плитка `Словарь` открывает таб словаря и показывает краткое состояние по `get-vocabulary-state`: `Добавить: N` или `В словаре: N`.
- На главной карточка урока использует `homeProgress.lesson.status` и `homeProgress.lesson.currentStep`; daily lesson последовательно ведет на чтение, затем на повторение слов.
- Шаг повторения на главной показывает `Слов на повторение нет`, когда сервер вернул `completed`, обязательный остаток равен нулю и `reviewedTodayCount = 0`; completed-подсветка при этом сохраняется.
- Счетчик с иконкой огонька на главной использует `streakDays`, который сервер считает как серию подряд идущих завершений чтения по учебным датам с границей `05:00 Europe/Moscow`; `useAppUserProfile` обновляет профиль при возврате в приложение и смене учебной даты, чтобы пропущенный день сбрасывал видимую серию без ручного перезапуска.
- Если генерация упала, новая попытка уже списана, новый текст не сохраняется, а ранее активный текст независимо от даты генерации остается доступен после завершения состояния загрузки.
- После неуспешной генерации экран чтения повторно запрашивает `get-reading-state`, чтобы синхронизировать активный текст и оставшиеся попытки с сервером.
- Экран чтения показывает источник текста (`AI` + модель или `DB`) через metadata `ReadingText.source/generation`.
- Настройка времени чтения влияет на размер AI-текста:
  - `3` мин: `120-180` слов, `max_tokens: 700`
  - `5` мин: `220-320` слов, `max_tokens: 1050`
  - `10` мин: `450-650` слов, `max_tokens: 1800`
  - `15` мин: `700-950` слов, `max_tokens: 2600`.
- При bootstrap настройки пользователя должны приходить с backend, если `settings_completed_at` уже заполнен.
- `users.first_text_completed_at` используется только для онбординга; ежедневный факт прочтения хранится отдельно в `user_daily_reading_completions`.
- Экран настроек содержит уровень английского, время чтения, отправку отчета об ошибке, карточку текущей версии с вручную открываемым release note и опциональную ссылку обратной связи через `VITE_FEEDBACK_TELEGRAM_USERNAME`; dev tools панель отображается только для роли `admin` и свернута по умолчанию.
- После сохранения первоначальных настроек доступны `Главная`, `Текст`, `Слова` и `Материалы`; дневной урок при этом по-прежнему начинается с шага `Текст`.
- После нажатия "Завершить текст" единственный active text сохраняется в историю с текущей учебной датой и удаляется; генерация в текущий учебный день остается доступна, пока не исчерпан дневной лимит генераций.
- Для прогресса дня и streak достаточно первого завершенного текста за дату; `user_completed_reading_texts` может хранить несколько завершенных текстов с одинаковым `completed_date`, различающихся `completed_at`.
- App-level toast-сообщения вынесены в `src/components/Toast.tsx`: `AppToast` поддерживает variant-состояния `success`, `warning`, `error`, а совместимый wrapper `Toast` мапит текущие тоны `default`, `onboarding`, `success`, `error`; toast показывается сверху как floating glass card с кнопкой закрытия.
- Inline status-сообщения внутри экранов должны использовать `src/components/InlineStatusCard.tsx`; app-level floating сообщения остаются в `src/components/Toast.tsx`.
- `vite.config.ts` разрешает внешние tunnel host'ы (`.trycloudflare.com`, `.loca.lt`) для запуска Mini App через Telegram.
- `npm run dev:telegram` автоматически поднимает frontend/API туннели и печатает `STARTUP SUMMARY` с двумя URL:
  - `BotFather /setmenubutton URL` = FRONTEND TUNNEL URL
  - `.env.telegram.local VITE_SUPABASE_URL` = SUPABASE API TUNNEL URL.
- Каждый Quick Tunnel создается один раз; команда ждёт публикацию URL в выводе `cloudflared`, но не блокирует запуск публичной DNS/HTTP-проверкой. `STARTUP SUMMARY` печатается после получения обоих URL.
- `npm run dev:telegram` запускает production-like локальный режим для Telegram: Supabase + Edge Functions + API tunnel + frontend build и watcher в `dist-telegram` + Vite preview в mode `telegram-dev` + frontend tunnel. Обычный `pnpm build` пишет только в `dist` и не перезаписывает активный Telegram dev bundle.
- Новые миграции без пересоздания БД применяются через `npx supabase migration up`; полный `npx supabase db reset` пересоздает локальную БД и удаляет текущие локальные данные.
- `npm run dev:telegram` поднимает Edge Functions `approve-vocabulary-card`, `approve-vocabulary-cards`, `auth-telegram`, `save-user-settings`, `activate-subscription`, `complete-reading-text`, `dev-tools`, `get-reading-state`, `get-reading-history`, `get-vocabulary-review-state`, `review-vocabulary-word`, `get-vocabulary-state`, `get-vocabulary-words`, `generate-reading-text`, `prepare-vocabulary-cards`, `save-reading-position`, `save-vocabulary-word` и `submit-support-report`.
- Логи в dev-режимах цветные по источнику (`[frontend]`, `[edge]`, `[db]`, `[api]`, `[tunnel-*]`), HTTP-методы и статус-коды дополнительно подсвечиваются.
- После изменения frontend-кода дождаться успешной пересборки `[frontend-watch]` и обновить Mini App без перезапуска tunnel. Полный dev-режим перезапускать после изменения server env для OpenRouter (`OPENROUTER_MODEL_*`, `OPENROUTER_API_KEY`), `.env.telegram.local`, Vite config, dependencies или завершения обязательного процесса.
- Quick Tunnel URL создаются один раз и не блокируют запуск Node DNS readiness-check: Windows `getaddrinfo` может временно сохранять отрицательный DNS-результат после публикации публичной записи. Если новый URL сразу не открылся в Telegram, нужно повторить открытие через несколько секунд, не перезапуская dev-stack.
- После ответа BotFather `Success! Menu settings updated` Telegram Desktop может показать прежний текст menu button ещё некоторое время из-за клиентского кеша. Текущий dev-stack и Quick Tunnel нужно оставить запущенными; перезапуск требуется только при фактическом завершении обязательного процесса или недоступности URL после ожидания.
- Неожиданное завершение frontend preview, frontend watcher, Edge Functions или любого tunnel останавливает dev-stack с ошибкой; завершение необязательного DB/API log-stream только фиксируется в логах.
- Live-потоки DB/API используют `docker logs --tail 0 --follow`, чтобы накопленная история контейнеров не скрывала `STARTUP SUMMARY`.
- Для локального Telegram-старта использовать `npm run dev:telegram`, для остановки Supabase: `npm run dev:stop`.
- Security-контекст зафиксирован в `notes/security-threat-model.md`, результат проверки базового контура — в `notes/security-audit-2026-04-30.md`.
- Security-модель AI-пайплайна зафиксирована в `notes/ai-pipeline-security.md`.
- Retention policy и SQL-диагностика AI-попыток зафиксированы в `notes/ai-observability-diagnostics.md`.
- Ручной AI red-team checklist зафиксирован в `notes/ai-red-team-checklist.md`.
- Flow сохранения слов зафиксирован в `notes/vocabulary-save-flow.md`.
- Алгоритм и flow дневного повторения слов зафиксированы в `notes/vocabulary-review.md`.
- Роли, effective access и MVP-подписки зафиксированы в `notes/subscriptions.md`.
- Отчеты об ошибках, request id и diagnostic snapshot зафиксированы в `notes/support-diagnostics.md`.
- Версия приложения, последний пользовательский release note и build metadata находятся в `src/constants/currentRelease.ts` и `src/config/releaseMetadata.ts`; полная техническая история релизов хранится в `CHANGELOG.md`.
- Vite передает во frontend compile-time `appVersion`, `buildId` и `environment`: Vercel Git SHA для deployment либо безопасный fallback `local`, без чтения runtime env и secrets в браузере.
- Skill source для triage support reports лежит в `docs/agents/skills/english-daily-loop-support-triage`.
- Skill source для pre-code triage багов и формирования пачек лежит в `docs/agents/skills/triage-english-daily-loop-bugs`.
- Skill source для grooming новых фич лежит в `docs/agents/skills/english-daily-loop-feature-spec`; draft-файлы фич хранятся во внешней папке `D:\anastasiaStorage\pet-projects\English daily loop\Фичи`.
- Ссылка обратной связи из настроек зафиксирована в `notes/feedback-link.md`.
- Production-схема деплоя зафиксирована в `notes/deployment-platform-decision.md`: frontend на Vercel, backend/data на Supabase Cloud.
- Production env inventory зафиксирован в `notes/production-env.md`; реальные секреты в репозиторий не записывать.
- Ручной runbook первого production-деплоя зафиксирован в `notes/production-deploy-flow.md`; миграции и production-секреты применяет владелец проекта.
- Ручной smoke checklist production-деплоя зафиксирован в `notes/production-smoke-checklist.md`.
- Релизы используют SemVer; перед release commit должны совпадать `package.json.version`, `currentRelease` и version heading в `CHANGELOG.md`, что проверяет `pnpm release:check`.
