# english-daily-loop

Telegram Mini App для ежедневной практики английского языка.

Проект находится в MVP-стадии. Основной фокус: короткий ежедневный цикл обучения, генерация текста для чтения под уровень пользователя, дневной прогресс, история материалов и простая модель подписок.

## Что уже есть

- Telegram Mini App с авторизацией через `Telegram WebApp initData`.
- Онбординг с настройками уровня английского и времени чтения.
- Экран `Текст` с AI-генерацией текста через OpenRouter и mobile-first glass UI для idle, active text, loading, error и completed состояний.
- Серверные дневные лимиты генерации текста.
- Активный непрочитанный текст на пользователя.
- Завершение чтения, сохранение нескольких текстов за день в историю и streak по дням.
- Раздел `Мои материалы` с историей прочитанных текстов, словарем, glass-табами, входом из нижней навигации и индикатором действий по словарю на главной.
- Словарь: быстрое добавление слова из активного текста, отдельная AI-подготовка карточек и просмотр готовых слов; подтверждение и редактирование карточек не доступны в пользовательском UI.
- Дневное повторение готовых карточек по интервальной шкале от 1 дня до 6 месяцев с действиями `Не помню`, текущий шаг, следующий шаг и шаг через один.
- Mobile-first главная страница с full-bleed Telegram layout, compact bottom navigation `Главная` / `Текст` / `Слова` / `Материалы`, glass UI и дизайн-токенами.
- Тема приложения по умолчанию следует системной теме Telegram; пользователь может выбрать режим `Как в Telegram`, светлую или темную тему через трехпозиционный переключатель в header главной.
- Экран настроек использует mobile-first glass UI для выбора уровня английского и времени чтения.
- Дневной прогресс и план урока объединяют последовательные шаги `Текст` и `Повторение`.
- Единые app-level toast-сообщения показываются сверху как floating glass card с variant-состояниями `success`, `warning`, `error`.
- Общие UI primitives: `ScreenHeader`, `LoadingState`, `InlineStatusCard`, shared `Button`.
- Роли доступа `admin` / `tester` / `user`; `admin` и `tester` получают internal paid-like доступ без платежей, а пользовательский flow подписки скрыт до подключения реальной оплаты.
- Отправка отчета об ошибке из настроек: пользовательский комментарий, последние client events, request ids и safe AI diagnostics сохраняются в `public.support_reports`.
- Базовый security-контур: server-side Telegram auth, RLS/grants hardening, защищенные секреты и безопасные ошибки Edge Functions.
- Локальный Telegram-запуск через `npm run dev:telegram`.

## Стек

- Vite
- React
- TypeScript
- pnpm
- Tailwind CSS 4
- `@fontsource/inter` и `@fontsource/manrope`
- `lucide-react`
- Supabase local
- Supabase Edge Functions
- Postgres
- OpenRouter для AI-генерации текстов и карточек слов
- Cloudflare Tunnel для запуска Mini App внутри Telegram во время локальной разработки

## Архитектура

В проекте нет отдельного Express/Nest backend. Backend-слой сейчас состоит из Supabase API, Postgres и Supabase Edge Functions.

Основная граница ответственности:

- `src/screens` — UI-экраны приложения.
- `src/components` — общие UI-компоненты и feature-компоненты экранов.
- `src/hooks` — app-level и feature hooks для профиля пользователя, toast, действий приложения и локальной UI-логики.
- `src/services` — клиентский сервисный слой, который вызывает Supabase и Edge Functions.
- `src/types` — общие frontend/domain типы.
- `supabase/migrations` — схема базы данных.
- `supabase/functions` — серверная логика в Deno runtime.
- `notes` — проектные решения и текущие ограничения.
- `docs/agents` — рабочая документация для AI-агентов, включая дизайн-систему и локальный Telegram-запуск.
- `scripts/dev-stack.mjs` и `scripts/dev/*` — локальная инфраструктура разработки.
- `tools` — локальные утилиты вроде `cloudflared.exe`; папка не коммитится.

Важный принцип: frontend не принимает security/business-решения по лимитам, подписке и Telegram auth. Он отображает состояние, которое возвращает сервер.

## Edge Functions

Сейчас используются функции:

- `auth-telegram` — валидирует Telegram `initData`, создает или находит пользователя, возвращает роль, настройки, effective subscription summary, прогресс главного экрана и streak.
- `save-user-settings` — валидирует пользователя на сервере и сохраняет настройки в `user_settings`.
- `activate-subscription` — скрытая server-side заготовка для будущего платного flow; работает только при `SUBSCRIPTION_FLOW_ENABLED="true"` и транзакционно активирует MVP-подписку за 0 рублей.
- `get-reading-state` — возвращает состояние экрана чтения: активный текст текущей московской даты, лимиты, использованные попытки и факт завершения чтения за день.
- `generate-reading-text` — атомарно списывает попытку, вызывает OpenRouter, валидирует ответ модели и сохраняет активный текст с `reading_date`.
- `complete-reading-text` — транзакционно завершает активный текст текущей московской даты, сохраняет snapshot текста в историю, удаляет active text и обновляет streak.
- `get-reading-history` — возвращает историю прочитанных текстов текущего пользователя с cursor-пагинацией.
- `save-vocabulary-word` — валидирует активный текст текущей московской даты, проверяет лимит словаря и быстро сохраняет слово как `not_started` + `pending`.
- `get-vocabulary-state` — возвращает количество pending/needs_approval/ready слов в словаре пользователя и состояние дневного лимита подготовки AI-карточек; пользовательский UI показывает pending и ready.
- `get-vocabulary-words` — возвращает готовые карточки словаря; скрытый approval-flow оставлен в коде для следующих версий.
- `prepare-vocabulary-cards` — batch-ом до 5 pending-слов списывает дневную попытку подготовки карточек, готовит AI-карточки, пробует следующую allowlist-модель при невалидном AI-ответе или provider-ошибке, сохраняет валидные карточки как `ready` и мержит pending-дубликаты в существующие канонические карточки.
- `approve-vocabulary-card` — скрытая server-side операция для будущего flow проверки карточек.
- `approve-vocabulary-cards` — скрытая server-side операция для будущего массового flow проверки карточек.
- `get-vocabulary-review-state` — возвращает точный snapshot дневной очереди, прогресс, следующую карточку и действия словаря.
- `review-vocabulary-word` — атомарно применяет выбранный интервал и завершает дневной план после последней обязательной карточки.
- `dev-tools` — технические действия для admin-пользователя; управляет попытками генерации, чтением, повторением слов, batch-переносом дневной очереди на выбранный шаг и подписками; работает только при `DEV_TOOLS_ENABLED="true"` и `users.app_role = 'admin'`.
- `submit-support-report` — принимает пользовательский отчет об ошибке, валидирует Telegram `initData`, применяет rate limit и сохраняет sanitized diagnostic snapshot в `public.support_reports`.

Все чувствительные операции выполняются на сервере. `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` и `OPENROUTER_API_KEY` нельзя использовать в клиентском коде. Неожиданные внутренние ошибки Edge Functions логируются на сервере, а клиент получает безопасный код и сообщение без SQL/provider details.

Общая server-инфраструктура Edge Functions находится в `supabase/functions/_shared/server.ts`: CORS, POST guard, JSON parsing, чтение env, Telegram `initData` validation, request id, `AppError` и единый формат JSON-ответов. Общий helper safe AI diagnostics находится в `supabase/functions/_shared/ai-diagnostics.ts`. Общий helper московской учебной даты находится в `supabase/functions/_shared/moscow-date.ts`. Роли, effective subscription summary и лимиты доступа считаются в `supabase/functions/_shared/access.ts`. Общий OpenRouter client/model allowlist находится в `supabase/functions/_shared/openrouter.ts`, общие AI text helpers — в `supabase/functions/_shared/ai-text.ts`. Лимит, подсчет и metadata попыток подготовки карточек вынесены в `supabase/functions/_shared/vocabulary-card-generation.ts`, snapshot повторения и home progress — в `supabase/functions/_shared/vocabulary-review-state.ts` и `supabase/functions/_shared/home-progress.ts`, streak чтения — в `supabase/functions/_shared/reading-streak.ts`.
Prompt/output слой словарных карточек находится рядом с функцией подготовки: `supabase/functions/prepare-vocabulary-cards/ai-pipeline.ts`. Сохранение подготовленных карточек и merge pending-дубликатов в существующие канонические карточки вынесены в `supabase/functions/prepare-vocabulary-cards/card-persistence.ts`.

## Данные

Ключевые таблицы:

- `public.users`
- `public.user_settings`
- `public.reading_texts`
- `public.reading_generation_attempts`
- `public.user_active_reading_texts`
- `public.user_daily_reading_completions`
- `public.user_completed_reading_texts`
- `public.user_subscriptions`
- `public.user_vocabulary_words`
- `public.user_vocabulary_word_sources`
- `public.vocabulary_card_generation_attempts`
- `public.user_daily_vocabulary_review_completions`
- `public.support_reports`

Дневной цикл считается по timezone `Europe/Moscow`.

`public.user_settings` хранит уровень английского и время чтения: `english_level`, `daily_reading_minutes`.

Доступ к чувствительным пользовательским данным идет через Edge Functions. На пользовательских, reading-state, completion/history и subscription таблицах включен RLS. Для `anon` и `authenticated` явно закрыт прямой доступ к защищенным таблицам и server-only RPC; серверные операции выполняются через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`. Клиент не пишет напрямую в пользовательские, reading и subscription таблицы.

`public.reading_generation_attempts` хранит безопасные metadata AI-попыток: prompt version, model chain, target/validation ranges, output word count, fallback flag, duration, failure stage и sanitized error details. Полный prompt, raw provider response, полный generated text, Telegram `initData`, secrets и stack trace в attempt metadata не пишутся.

AI attempt metadata хранится `90` дней; scheduled cleanup выполняется server-side через `pg_cron` job `cleanup_ai_generation_attempts`.

`public.vocabulary_card_generation_attempts` хранит дневные попытки подготовки AI-карточек словаря: provider/model, prompt version, model chain, количество запрошенных/подготовленных/неподготовленных карточек, merge/reactivation counters, duration и sanitized error details. Записи хранятся `90` дней; scheduled cleanup выполняется server-side через `pg_cron` job `cleanup_vocabulary_card_generation_attempts`.

`public.support_reports` хранит только вручную отправленные пользователем отчеты об ошибках: комментарий, текущий экран, безопасный app context, последние client events, request ids и safe AI diagnostics. Таблица закрыта для `anon`/`authenticated`, запись идет через Edge Function `submit-support-report`; отчеты хранятся `30` дней и очищаются job `cleanup_support_reports`.

Критичные операции, где важна защита от параллельных запросов, вынесены в Postgres RPC:

- `public.claim_reading_generation_attempt(...)` — проверяет дневной лимит и создает attempt одним DB-действием.
- `public.complete_daily_reading_text(...)` — завершает active text текущей даты, пишет дневной completion-marker, сохраняет snapshot текста в историю, удаляет active text и обновляет onboarding-флаг.
- `public.activate_mvp_subscription(...)` — активирует или планирует MVP-подписку с advisory lock по пользователю.
- `public.save_pending_vocabulary_word_with_source(...)` — сохраняет pending-слово и источник из active text текущей даты с advisory lock по пользователю.
- `public.claim_vocabulary_card_generation_attempt(...)` — атомарно проверяет дневной лимит подготовки карточек и создает attempt с advisory lock по пользователю и дате.
- `public.review_vocabulary_word(...)` — применяет действие повторения, обновляет интервалы и создает дневной completion-marker.
- `public.get_or_create_vocabulary_review_state(...)` — атомарно считает очередь, фиксирует завершение пустого или выполненного плана и возвращает отдельные счетчики для обязательного плана и экрана повторения.

Текущие MVP-лимиты:

- `free`: 3 генерации текста в день, словарь до 30 слов.
- `paid`: 10 генераций текста в день, словарь до 300 слов.
- Подготовка AI-карточек словаря: `free` — 5 batch-попыток в день, `paid` — 20 batch-попыток в день.
- Роли `admin` и `tester` получают paid-like лимиты через internal access без строки в `user_subscriptions`.

Одна попытка подготовки карточек равна одному запросу `prepare-vocabulary-cards` для batch до 5 pending-слов. Если pending-слов нет, попытка не списывается. Если AI/provider/validation завершились ошибкой после списания, попытка считается использованной.

Подписки пока не продаются в пользовательском интерфейсе:

- `monthly` действует 1 день.
- `yearly` действует 7 дней.
- реальные платежи не подключены.
- экран и кнопка подписки скрыты через `SHOW_SUBSCRIPTION_FLOW = false`; код `SubscriptionScreen` и `activate-subscription` сохранен для будущего платежного flow.

## Переменные окружения

Production-переменные frontend хранятся в Vercel, а server secrets — в Supabase Cloud. `.env.production.example` фиксирует только имена, назначение и безопасные placeholder-значения; production runtime не читает этот файл.

Для локального Telegram-запуска создай отдельный `.env.telegram.local` на основе `.env.telegram.example`. `npm run dev:telegram` не читает и не изменяет `.env.local`.

Обязательные значения для Telegram dev mode:

```env
TELEGRAM_DEV_MODE="true"
DEV_TELEGRAM_BOT_USERNAME="@english_daily_loop_dev_bot"
TELEGRAM_BOT_TOKEN="YOUR_DEV_TELEGRAM_BOT_TOKEN"
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
DEV_TOOLS_ENABLED="true"
SUBSCRIPTION_FLOW_ENABLED="false"
```

`DEV_TELEGRAM_BOT_USERNAME` и `TELEGRAM_BOT_TOKEN` должны принадлежать отдельному development-боту. Скрипт откажется запускаться для production-бота `@english_daily_loop_bot`.

`VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в `.env.telegram.local` обновляются автоматически значениями локального Supabase и текущего API tunnel. Frontend Telegram dev-сборки получает env напрямую от скрипта и не загружает обычные Vite env-файлы.

Опциональные переменные для выбора OpenRouter-моделей:

```env
OPENROUTER_MODEL_CHAIN="qwen/qwen3-next-80b-a3b-instruct:free,nvidia/nemotron-nano-9b-v2:free,google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,openai/gpt-oss-20b:free"
```

`OPENROUTER_MODEL_PRIMARY`, `OPENROUTER_MODEL_FALLBACK` и `OPENROUTER_MODEL_TERTIARY` можно использовать как дополнительные модели после дефолтной цепочки, если `OPENROUTER_MODEL_CHAIN` не задан.

`VITE_FEEDBACK_TELEGRAM_USERNAME` задает публичную ссылку обратной связи в настройках. Укажи username без `@`, например `my_username`; если переменная пустая или не похожа на Telegram username, блок обратной связи не показывается.

Отчеты об ошибках отправляются из настроек через `submit-support-report` и не требуют отдельного env: отчет сохраняется в `public.support_reports`, а разработчик просматривает его в БД.

`SUBSCRIPTION_FLOW_ENABLED` оставляем `"false"`, пока пользовательский flow подписки и реальные платежи выключены.

Правило безопасности: во frontend доступны только переменные с префиксом `VITE_`. AI-ключи, Telegram token и service role key должны оставаться только на серверной стороне.

## Локальный запуск

Нужны:

- Node.js
- pnpm
- Docker Desktop
- локальная утилита `tools/cloudflared.exe` для Telegram Mini App запуска через HTTPS tunnel

Установить зависимости:

```bash
pnpm install
```

Запустить локальный стек для Telegram:

```bash
npm run dev:telegram
```

`dev:telegram` делает следующее:

- проверяет отдельного dev-бота и обязательный маркер `TELEGRAM_DEV_MODE="true"`;
- запускает локальный Supabase;
- получает локальный anon key из Supabase CLI;
- запускает Edge Functions;
- поднимает tunnel для Supabase API;
- автоматически обновляет `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` только в `.env.telegram.local`;
- собирает frontend через изолированный `pnpm build:telegram`;
- запускает frontend через Vite preview на `localhost:3000`;
- поднимает tunnel для frontend;
- показывает логи frontend, Edge Functions, DB и API;
- печатает `STARTUP SUMMARY` с URL для BotFather.

Frontend собирается после получения API tunnel URL, поэтому Telegram открывает production-like bundle с актуальным `VITE_SUPABASE_URL`.

Если в summary указано `Frontend restart required: YES`, останови процесс через `Ctrl + C` и запусти `npm run dev:telegram` еще раз.

Новые миграции без пересоздания локальной БД применяются командой:

```bash
npx supabase migration up
```

Полный reset локальной БД:

```bash
npx supabase db reset
```

Важно: `db reset` пересоздает локальную БД и удаляет текущие локальные данные.

Остановить локальный Supabase:

```bash
npm run dev:stop
```

## Запуск внутри Telegram

После `npm run dev:telegram` дождись `STARTUP SUMMARY`.

В BotFather:

1. Выполни `/setmenubutton`.
2. Выбери отдельного dev-бота, указанного в `DEV_TELEGRAM_BOT_USERNAME`.
3. Вставь `BotFather /setmenubutton URL` из startup summary.
4. Открой бота в Telegram и нажми кнопку меню.

Не устанавливай временный tunnel URL production-боту `@english_daily_loop_bot`.

Приложение должно открываться внутри Telegram и проходить авторизацию через настоящий `initData`.

## Команды

```bash
pnpm dev
```

Запускает только frontend через Vite dev server. Для проверки Telegram Mini App используется `npm run dev:telegram`.

```bash
npm run dev:telegram
```

Запускает локальную инфраструктуру для Telegram Mini App с tunnels, production-like frontend bundle и реальным Telegram `initData`.

```bash
npm run dev:stop
```

Останавливает локальный Supabase.

```bash
pnpm lint
```

Запускает TypeScript-проверку frontend-кода.

```bash
pnpm test
```

Запускает unit-тесты интервалов повторения, навигационного стека и русских форм счетчиков.

```bash
pnpm build
```

Собирает production build frontend-приложения.

## Разработка

- Новую работу с данными лучше выносить в `src/services`, а не напрямую в UI-компоненты.
- App-level orchestration держать в hooks: профиль пользователя и refresh — в `useAppUserProfile`, toast — в `useToast`, пользовательские действия и локальные обновления `homeProgress` — в `useAppUserActions`.
- Общие типы держать в `src/types`.
- Дизайн-токены и общие glass utilities держать в `src/index.css`; актуальные UI-правила главной фиксировать в `docs/agents/DESIGN_SYSTEM.md`.
- Для внутренних экранов с back navigation использовать `ScreenHeader`; для встроенных статусов использовать `InlineStatusCard`; для загрузок использовать `LoadingState`.
- UI экрана чтения держать как контейнер `src/screens/ReadingScreen.tsx`, презентационные компоненты `src/components/reading/*` и helper парсинга текста `src/utils/readingText.ts`.
- Серверные проверки Telegram `initData`, ролей, лимитов и подписок должны оставаться в Edge Functions.
- Общую инфраструктуру Edge Functions нужно переиспользовать из `supabase/functions/_shared/server.ts`, а доменные проверки держать рядом с бизнес-операцией конкретной функции.
- Для frontend-вызовов Edge Functions использовать `src/services/functionClient.ts`; request id, diagnostic extraction и ошибки держать в `src/services/edgeFunctionErrors.ts`.
- Server-only таблицы и RPC должны оставаться закрытыми для `anon` и `authenticated`; новые чувствительные операции нужно добавлять через Edge Functions и миграции прав доступа.
- Edge Functions работают в Deno runtime и исключены из корневого frontend `tsconfig.json`.
- Панель dev tools показывается только пользователю с ролью `admin`, а изменения БД выполняются только при server env `DEV_TOOLS_ENABLED="true"` и server-side проверке `users.app_role = 'admin'`.
- После изменения frontend-кода, Edge Functions или server env нужно перезапустить `npm run dev:telegram`.
- После существенных изменений стоит запускать минимум `pnpm lint`.

## Документация проекта

Дополнительный контекст лежит в:

- `AGENTS.md` — правила работы в репозитории и текущий статус.
- `GIT_POLICY.md` — строгая политика Git для AI-агентов.
- `docs/agents/LOCAL_TELEGRAM_RUN.md` — подробный локальный запуск внутри Telegram.
- `docs/agents/DESIGN_SYSTEM.md` — актуальная дизайн-система приложения.
- `docs/agents/skills/english-daily-loop-support-triage` — project-local skill source для разбора support reports и AI diagnostics.
- `notes/server-side-data-guards.md` — серверные границы доступа, RLS и транзакционные RPC.
- `notes/security-threat-model.md` — модель угроз MVP и чеклист security-аудита.
- `notes/security-audit-2026-04-30.md` — результат проверки базового security-контура.
- `notes/ai-pipeline-security.md` — security-модель AI-пайплайна генерации текста.
- `notes/ai-observability-diagnostics.md` — retention policy и SQL-диагностика AI-попыток.
- `notes/ai-red-team-checklist.md` — ручные adversarial-проверки AI-пайплайна.
- `notes/text-generation-pipeline.md` — AI-пайплайн генерации текста.
- `notes/reading-generation-limits.md` — дневные попытки и активный текст.
- `notes/materials-and-reading-history.md` — раздел `Мои материалы` и история прочитанных текстов.
- `notes/vocabulary-save-flow.md` — словарь: сохранение слов из активного текста, AI-подготовка карточек и дневные попытки подготовки.
- `notes/vocabulary-review.md` — алгоритм, дневная очередь, server-side progress и UI повторения слов.
- `notes/subscriptions.md` — MVP-модель ролей, доступа и подписок.
- `notes/support-diagnostics.md` — пользовательские отчеты об ошибках, request id и безопасный diagnostic snapshot.
- `notes/feedback-link.md` — ссылка обратной связи из настроек в Telegram.
- `notes/deployment-platform-decision.md` — выбранная production-схема Supabase Cloud + Vercel и fallback-варианты.
- `notes/production-env.md` — production env inventory для Vercel и Supabase Edge Functions.
- `notes/production-deploy-flow.md` — ручной runbook первого production-деплоя через Supabase Cloud + Vercel.
- `notes/production-smoke-checklist.md` — ручной smoke checklist для проверки production-деплоя.
- `notes/home-progress-and-toast.md` — прогресс главного экрана и toast-сообщения.
- `notes/dev-mode-dx.md` — локальный Telegram-режим разработки и ограничения DX.
- `notes/production-readiness.md` — что нужно пересмотреть перед production.
