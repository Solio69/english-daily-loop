# AGENTS.md

## Назначение
Этот файл фиксирует правила работы AI-агентов в репозитории, чтобы процесс был предсказуемым, безопасным и удобным для владельца проекта.

## Контекст проекта
- Проект: `english-daily-loop`.
- Текущий стек: Vite + React + TypeScript.
- Пакетный менеджер: `pnpm`.
- Целевой продукт: Telegram Mini App.
- Вектор по данным: Supabase (Postgres).
- Локальная инфраструктура уже настроена: Docker + WSL + Supabase local.
- Локальный Telegram-запуск: `npm run dev:telegram` (Supabase + Edge Functions + API tunnel + автообновление `VITE_SUPABASE_URL` в `.env.local` + frontend build + Vite preview + frontend tunnel + логи DB/API + startup summary).
- Отдельного backend-сервера (Express) сейчас нет; backend-слой представлен Supabase API + Edge Functions.
- Папка `tools/` используется для локальных утилит запуска (например, `cloudflared.exe`) и не коммитится.

## Правила коммуникации
- По умолчанию объяснять на русском языке.
- Каждую команду объяснять перед запуском: что она делает и зачем.
- В режимах настройки и отладки с пользователем давать по одной команде за шаг.
- После шага ждать вывод/скриншот пользователя и только потом двигаться дальше.
- Тон: поддерживающий, без оценочности и давления.
- Предпочитать короткие и практичные инструкции вместо длинной теории.

## Правила принятия решений
- Не спешить с реализацией, пока архитектурный выбор не согласован.
- Для решений с компромиссами (стоимость, безопасность, lock-in) кратко показывать варианты.
- Предпочитать маленькие итеративные изменения вместо крупных рефакторингов.
- Перед изменениями с неочевидными последствиями явно подтверждать направление.

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
- Секреты хранить в `.env.local`, а требования документировать в `.env.example`.
- `SUPABASE_SERVICE_ROLE_KEY` использовать только на сервере.
- `OPENROUTER_API_KEY` использовать только на сервере, через Supabase Edge Functions.
- `TELEGRAM_BOT_TOKEN` использовать только на сервере, через Supabase Edge Functions.
- Не ослаблять контроль доступа ради скорости разработки.

## Правила внесения изменений
- Сохранять текущую структуру и стиль проекта, если явный рефакторинг не запрошен.
- Делать небольшие, проверяемые изменения.
- Не использовать разрушительные git/file операции без явного запроса.
- После существенных изменений запускать проверки (минимум `pnpm lint`) и сообщать результат.

## Жесткая Git-политика
- Агенту запрещены любые команды, меняющие историю или состояние репозитория: `git commit`, `git push`, `git merge`, `git rebase`, `git cherry-pick`, `git reset`, `git revert`, `git tag`, `git stash`, `git checkout` (для переключения/отката), `git switch`, `git restore`, `git clean`.
- Агент может использовать Git только в режиме чтения: `git status`, `git log`, `git diff`, `git show`, `git blame`, `git branch --show-current`, `git rev-parse`.
- Это строгое правило без исключений, пока пользователь явно не изменит политику в репозитории.
- Детальная формулировка вынесена в отдельный файл: `GIT_POLICY.md`.

## Текущий статус (для будущих агентов)
- Supabase local и Docker-окружение уже работают.
- Уже подключены и используются таблицы `public.users`, `public.user_settings`, `public.reading_texts`, `public.reading_generation_attempts`, `public.user_active_reading_texts`, `public.user_daily_reading_completions`, `public.user_completed_reading_texts` и `public.user_subscriptions`.
- В `public.user_settings` есть настройки `english_level`, `daily_exercise_minutes`, `daily_reading_minutes`.
- На пользовательских, reading-state, completion/history и subscription таблицах включен RLS; frontend не пишет в защищенные таблицы напрямую, операции проходят через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`.
- Миграция `supabase/migrations/20260430120000_harden_public_api_permissions.sql` явно закрывает прямой доступ `anon`/`authenticated` к защищенным таблицам, закрывает legacy RPC `get_random_reading_text` для клиента и оставляет server-only доступ через `service_role`.
- Миграция `supabase/migrations/20260430173000_add_ai_generation_observability.sql` добавляет безопасные metadata-поля AI-попыток в `public.reading_generation_attempts`: prompt version, model chain, target/validation ranges, output word count, fallback flag, duration и failure stage.
- Миграция `supabase/migrations/20260430190000_schedule_ai_attempt_cleanup.sql` включает `pg_cron` и создает scheduled cleanup job `cleanup_ai_generation_attempts` для удаления AI attempt metadata старше `90` дней.
- В проекте есть базовые миграции и сиды для локальной разработки (dev user + моковые тексты).
- Миграция `supabase/migrations/20260424113000_drop_daily_review_words_from_user_settings.sql` удаляет устаревшее поле `daily_review_words` из `public.user_settings`.
- Миграция `supabase/migrations/20260427165000_enable_rls_for_users_and_settings.sql` включает RLS для `public.users` и `public.user_settings`.
- Серверные транзакционные операции вынесены в Postgres RPC:
  - `public.claim_reading_generation_attempt(...)` — атомарная проверка лимита и списание попытки генерации
  - `public.complete_daily_reading_text(...)` — завершение чтения, completion, удаление active text и онбординг-флаг
  - `public.activate_mvp_subscription(...)` — активация MVP-подписки с advisory lock по пользователю.
- Корневой `tsconfig.json` исключает `supabase/functions`, потому что Edge Functions работают в Deno-рантайме и не должны проверяться frontend `tsc`.
- Общая server-инфраструктура Edge Functions находится в `supabase/functions/_shared/server.ts`: CORS, POST guard, JSON parsing, env helpers, Telegram `initData` validation, безопасные JSON-ответы и `AppError`.
- Edge Functions `auth-telegram`, `save-user-settings`, `activate-subscription`, `complete-reading-text`, `dev-tools`, `get-reading-state`, `get-reading-history` и `generate-reading-text` используют общий helper для Telegram auth/error/env/http слоя; бизнес-валидация остается внутри конкретных функций.
- Telegram auth реализована через Edge Function `supabase/functions/auth-telegram/index.ts`:
  - серверная валидация `initData` (подпись + `auth_date`)
  - идемпотентный `find-or-create/upsert` пользователя по `telegram_user_id`
  - ошибки Telegram validation возвращаются как `401 AUTH_VALIDATION_FAILED`, а внутренние DB/server ошибки как отдельные `5xx` коды
  - неожиданные внутренние ошибки возвращаются клиенту с безопасным сообщением без SQL/provider details, подробности остаются в server logs
  - возвращает `settings`, если `settings_completed_at` уже заполнен
  - возвращает `subscription` summary (`tier`, `limits`, активная/запланированная подписка)
  - возвращает `homeProgress.lesson` (`status`, `currentStep`) для карточки урока на главной
  - возвращает `homeProgress.reading.status` (`not_started | in_progress | completed`) для карточки дневного прогресса
  - возвращает `streakDays` для счетчика с иконкой огонька
  - единый контракт ответа (`ok/data` или `ok/error`).
- Сохранение настроек пользователя реализовано через Edge Function `supabase/functions/save-user-settings/index.ts`:
  - серверная валидация `Telegram initData`
  - валидация `english_level`, `daily_exercise_minutes`, `daily_reading_minutes`
  - upsert в `public.user_settings`
  - заполнение `users.settings_completed_at`, если настройки сохраняются впервые
  - возврат актуальных `settings`, `subscription`, `homeProgress` и `streakDays`.
- MVP-подписки реализованы через таблицу `public.user_subscriptions`:
  - `plan_type`: `monthly` или `yearly`
  - `starts_at` / `ends_at` хранятся как `timestamptz`
  - активность подписки вычисляется сервером по интервалу `starts_at <= now < ends_at`
  - `monthly` действует 1 день, `yearly` действует 7 дней от момента оформления
  - `source = 'mvp_zero_price'`, реальные платежи пока не подключены.
- Оформление подписки реализовано через Edge Function `supabase/functions/activate-subscription/index.ts`:
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
  - проверка дневного завершения чтения по `user_daily_reading_completions`
  - атомарная проверка дневного лимита и списание попытки через RPC `claim_reading_generation_attempt`
  - prompt/provider/output слой находится в `supabase/functions/generate-reading-text/ai-pipeline.ts`
  - текущий prompt version: `reading-text-v1`
  - OpenRouter model chain проходит server-side allowlist до списания попытки
  - генерация через OpenRouter `models` parameter с цепочкой free-моделей `primary -> fallback -> tertiary`
  - динамический `max_tokens` и диапазон слов по времени чтения
  - output validation проверяет JSON, title/body, `estimatedMinutes`, `level`, длину с допуском примерно `±20%` и базовые content-safety patterns
  - observability AI-попыток хранится в `reading_generation_attempts` как metadata без полного prompt, raw provider response, полного generated text, Telegram `initData`, secrets и stack trace
  - timeout запроса к OpenRouter: `45` секунд
  - сохранение последнего успешного непрочитанного текста в `user_active_reading_texts`
  - единый контракт ответа (`ok/data` или `ok/error`).
- Состояние экрана чтения реализовано через Edge Function `supabase/functions/get-reading-state/index.ts`:
  - серверная валидация `Telegram initData`
  - дата дня считается по timezone `Europe/Moscow`
  - возвращает активный текст, дневной лимит, использованные/оставшиеся попытки и флаг `isReadingCompletedToday`.
- Завершение чтения реализовано через Edge Function `supabase/functions/complete-reading-text/index.ts`:
  - серверная валидация `Telegram initData`
  - транзакционное завершение через RPC `complete_daily_reading_text`
  - запись дневного завершения в `user_daily_reading_completions`
  - сохранение snapshot прочитанного текста в `user_completed_reading_texts`
  - удаление активного непрочитанного текста из `user_active_reading_texts`
  - заполнение `users.first_text_completed_at` только для онбординга, если это первый прочитанный текст пользователя.
  - пересчет `streakDays` как серии подряд идущих дней по `user_daily_reading_completions`.
- История прочитанных текстов реализована через Edge Function `supabase/functions/get-reading-history/index.ts`:
  - серверная валидация `Telegram initData`
  - чтение завершенных текстов текущего пользователя из `user_completed_reading_texts`
  - cursor-пагинация через `limit` и `cursor`
  - единый контракт ответа (`ok/data` или `ok/error`).
- Локальные dev tools реализованы через Edge Function `supabase/functions/dev-tools/index.ts`:
  - серверная валидация `Telegram initData`
  - обязательный server env gate `DEV_TOOLS_ENABLED="true"`
  - actions: `reset_generation_attempts`, `delete_today_reading_completion`, `reset_subscriptions`
  - frontend-панель показывается только при `VITE_DEV_TOOLS_ENABLED="true"`.
- Текущие MVP-лимиты подписок:
  - free: `3` генерации текста в день, словарь до `30` слов
  - paid: `10` генераций текста в день, словарь до `300` слов.
- Дневной лимит генерации считается только на сервере в Edge Functions чтения по активной подписке из `user_subscriptions`; фронт только отображает полученные `dailyLimit/remainingAttempts`.
- Текущие дефолтные OpenRouter-модели:
  - primary: `openai/gpt-oss-20b:free`
  - fallback: `google/gemma-3-12b-it:free`
  - tertiary: `qwen/qwen3.6-plus:free`.
- Требуемые server env для AI:
  - `OPENROUTER_API_KEY`
  - опционально `OPENROUTER_MODEL_PRIMARY`
  - опционально `OPENROUTER_MODEL_FALLBACK`.
  - опционально `OPENROUTER_MODEL_TERTIARY`.
- Для стабильной DX в редакторе: у функции используется `// @ts-nocheck`, а для Deno-окружения есть `supabase/functions/deno.json` и `supabase/functions/deno-globals.d.ts`.
- На фронте подключен Telegram WebApp SDK (`index.html`) и типы `window.Telegram.WebApp` (`src/types/telegram-webapp.d.ts`).
- Bootstrap пользователя в `src/services/userService.ts` авторизуется через `auth-telegram` по Telegram `initData`; `AppUser` содержит `subscription`, `homeProgress` и `streakDays`.
- `src/services/userService.ts` сохраняет настройки через `save-user-settings`; прямых записей в `users` и `user_settings` с клиента нет.
- На фронте подписка вынесена в `src/services/subscriptionService.ts` и `src/screens/SubscriptionScreen.tsx`; клиент вызывает только `activate-subscription`, прямых записей подписки в БД с фронта нет.
- Логика чтения вынесена в сервисный слой (`src/services/readingService.ts`), UI-компонент не содержит прямых запросов к БД.
- `readingService` вызывает `get-reading-state`, `generate-reading-text` и `complete-reading-text`; текущий UI генерации не использует прямой RPC fallback `get_random_reading_text`.
- `materialsService` вызывает `get-reading-history`; экран `Мои материалы` показывает завершенные тексты с табами `Тексты` и `Словарь`, таб словаря зарезервирован под будущие слова на повторении.
- На главной есть компактная карточка `Мои материалы`; плитка `Тексты` открывает экран материалов на табе текстов, плитка `Словарь` открывает таб словаря.
- На главной карточка урока использует `homeProgress.lesson.status` и `homeProgress.lesson.currentStep`; пока daily lesson состоит только из чтения и ведет пользователя сразу на экран текста.
- Счетчик с иконкой огонька на главной использует `streakDays`, который сервер считает как серию подряд идущих завершений чтения по timezone `Europe/Moscow`.
- Если генерация упала, новая попытка уже списана, новый текст не сохраняется, а ранее активный текст остается доступен после завершения состояния загрузки.
- После неуспешной генерации экран чтения повторно запрашивает `get-reading-state`, чтобы синхронизировать активный текст и оставшиеся попытки с сервером.
- Экран чтения показывает источник текста (`AI` + модель или `DB`) через metadata `ReadingText.source/generation`.
- Настройка времени чтения влияет на размер AI-текста:
  - `3` мин: `120-180` слов, `max_tokens: 450`
  - `5` мин: `220-320` слов, `max_tokens: 750`
  - `10` мин: `450-650` слов, `max_tokens: 1300`
  - `15` мин: `700-950` слов, `max_tokens: 1900`.
- При bootstrap настройки пользователя должны приходить с backend, если `settings_completed_at` уже заполнен.
- `users.first_text_completed_at` используется только для онбординга; ежедневный факт прочтения хранится отдельно в `user_daily_reading_completions`.
- Экран настроек содержит уровень английского, время упражнений и время чтения; на главной третья плашка пока зафиксирована как `30 слов` для демо.
- В состоянии "настройки сохранены, но первый текст еще не прочитан" разделы `Упражнения` и `Слова` заблокированы, но `Главная` и `Текст` доступны.
- После нажатия "Завершить текст" генерация в текущий день блокируется, активный текст удаляется; новый дневной цикл открывается после `00:00` по `Europe/Moscow`.
- Верхние toast-сообщения вынесены в единый компонент `src/components/Toast.tsx` с тонами `default`, `onboarding`, `success`, `error`.
- `vite.config.ts` разрешает внешние tunnel host'ы (`.trycloudflare.com`, `.loca.lt`) для запуска Mini App через Telegram.
- `npm run dev:telegram` автоматически поднимает frontend/API туннели и печатает `STARTUP SUMMARY` с двумя URL:
  - `BotFather /setmenubutton URL` = FRONTEND TUNNEL URL
  - `.env.local VITE_SUPABASE_URL` = SUPABASE API TUNNEL URL.
- `npm run dev:telegram` запускает production-like локальный режим для Telegram: Supabase + Edge Functions + API tunnel + frontend build + Vite preview + frontend tunnel.
- Новые миграции без пересоздания БД применяются через `npx supabase migration up`; полный `npx supabase db reset` пересоздает локальную БД и удаляет текущие локальные данные.
- `npm run dev:telegram` поднимает Edge Functions `auth-telegram`, `save-user-settings`, `activate-subscription`, `complete-reading-text`, `dev-tools`, `get-reading-state`, `get-reading-history` и `generate-reading-text`.
- Логи в dev-режимах цветные по источнику (`[frontend]`, `[edge]`, `[db]`, `[api]`, `[tunnel-*]`), HTTP-методы и статус-коды дополнительно подсвечиваются.
- `// TODO:` после изменения frontend-кода, кода Edge Functions или server env для OpenRouter (`OPENROUTER_MODEL_*`, `OPENROUTER_API_KEY`) перезапускать активный dev-режим, чтобы локальная среда подхватила актуальную версию функций, env и frontend bundle.
- Если в summary указано `Frontend restart required: YES`, нужно перезапустить `npm run dev:telegram`.
- Для локального Telegram-старта использовать `npm run dev:telegram`, для остановки Supabase: `npm run dev:stop`.
- Security-контекст зафиксирован в `notes/security-threat-model.md`, результат проверки базового контура — в `notes/security-audit-2026-04-30.md`.
- Security-модель AI-пайплайна зафиксирована в `notes/ai-pipeline-security.md`.
- Retention policy и SQL-диагностика AI-попыток зафиксированы в `notes/ai-observability-diagnostics.md`.

