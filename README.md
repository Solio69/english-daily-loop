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
- MVP-подписки: `free` и `paid` тарифное состояние без реальных платежей.
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

- `auth-telegram` — валидирует Telegram `initData`, создает или находит пользователя, возвращает настройки, подписку, прогресс главного экрана и streak.
- `save-user-settings` — валидирует пользователя на сервере и сохраняет настройки в `user_settings`.
- `activate-subscription` — транзакционно активирует MVP-подписку за 0 рублей.
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
- `dev-tools` — локальные dev-действия для текущего Telegram-пользователя; управляет попытками генерации, чтением, повторением слов, batch-переносом дневной очереди на выбранный шаг и подписками; работает только при `DEV_TOOLS_ENABLED="true"`.

Все чувствительные операции выполняются на сервере. `TELEGRAM_BOT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` и `OPENROUTER_API_KEY` нельзя использовать в клиентском коде. Неожиданные внутренние ошибки Edge Functions логируются на сервере, а клиент получает безопасный код и сообщение без SQL/provider details.

Общая server-инфраструктура Edge Functions находится в `supabase/functions/_shared/server.ts`: CORS, POST guard, JSON parsing, чтение env, Telegram `initData` validation, `AppError` и единый формат JSON-ответов. Общий helper московской учебной даты находится в `supabase/functions/_shared/moscow-date.ts`. Общий OpenRouter client/model allowlist находится в `supabase/functions/_shared/openrouter.ts`, общие AI text helpers — в `supabase/functions/_shared/ai-text.ts`. Лимиты подготовки карточек вынесены в `supabase/functions/_shared/vocabulary-card-generation.ts`, snapshot повторения и home progress — в `supabase/functions/_shared/vocabulary-review-state.ts` и `supabase/functions/_shared/home-progress.ts`, streak чтения — в `supabase/functions/_shared/reading-streak.ts`.
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

Дневной цикл считается по timezone `Europe/Moscow`.

`public.user_settings` хранит уровень английского и время чтения: `english_level`, `daily_reading_minutes`.

Доступ к чувствительным пользовательским данным идет через Edge Functions. На пользовательских, reading-state, completion/history и subscription таблицах включен RLS. Для `anon` и `authenticated` явно закрыт прямой доступ к защищенным таблицам и server-only RPC; серверные операции выполняются через Edge Functions с `SUPABASE_SERVICE_ROLE_KEY`. Клиент не пишет напрямую в пользовательские, reading и subscription таблицы.

`public.reading_generation_attempts` хранит безопасные metadata AI-попыток: prompt version, model chain, target/validation ranges, output word count, fallback flag, duration, failure stage и sanitized error details. Полный prompt, raw provider response, полный generated text, Telegram `initData`, secrets и stack trace в attempt metadata не пишутся.

AI attempt metadata хранится `90` дней; scheduled cleanup выполняется server-side через `pg_cron` job `cleanup_ai_generation_attempts`.

`public.vocabulary_card_generation_attempts` хранит дневные попытки подготовки AI-карточек словаря: provider/model, prompt version, model chain, количество запрошенных/подготовленных/неподготовленных карточек, merge/reactivation counters, duration и sanitized error details. Записи хранятся `90` дней; scheduled cleanup выполняется server-side через `pg_cron` job `cleanup_vocabulary_card_generation_attempts`.

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

Одна попытка подготовки карточек равна одному запросу `prepare-vocabulary-cards` для batch до 5 pending-слов. Если pending-слов нет, попытка не списывается. Если AI/provider/validation завершились ошибкой после списания, попытка считается использованной.

Подписки пока тестовые:

- `monthly` действует 1 день.
- `yearly` действует 7 дней.
- реальные платежи не подключены.

## Переменные окружения

Создай `.env.local` на основе `.env.example`.

Обязательные переменные:

```env
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_DEV_TOOLS_ENABLED="false"
OPENROUTER_API_KEY="YOUR_OPENROUTER_API_KEY"
TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"
DEV_TOOLS_ENABLED="false"
```

Опциональные переменные для выбора OpenRouter-моделей:

```env
OPENROUTER_MODEL_CHAIN="qwen/qwen3-next-80b-a3b-instruct:free,nvidia/nemotron-nano-9b-v2:free,google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,openai/gpt-oss-20b:free"
```

`OPENROUTER_MODEL_PRIMARY`, `OPENROUTER_MODEL_FALLBACK` и `OPENROUTER_MODEL_TERTIARY` можно использовать как дополнительные модели после дефолтной цепочки, если `OPENROUTER_MODEL_CHAIN` не задан.

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

- запускает локальный Supabase;
- запускает Edge Functions;
- поднимает tunnel для Supabase API;
- автоматически обновляет `VITE_SUPABASE_URL` в `.env.local`;
- собирает frontend через `pnpm build`;
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
2. Выбери нужного бота.
3. Вставь `BotFather /setmenubutton URL` из startup summary.
4. Открой бота в Telegram и нажми кнопку меню.

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
- Серверные проверки Telegram `initData`, лимитов и подписок должны оставаться в Edge Functions.
- Общую инфраструктуру Edge Functions нужно переиспользовать из `supabase/functions/_shared/server.ts`, а доменные проверки держать рядом с бизнес-операцией конкретной функции.
- Server-only таблицы и RPC должны оставаться закрытыми для `anon` и `authenticated`; новые чувствительные операции нужно добавлять через Edge Functions и миграции прав доступа.
- Edge Functions работают в Deno runtime и исключены из корневого frontend `tsconfig.json`.
- Локальная панель dev tools показывается только при `VITE_DEV_TOOLS_ENABLED="true"`, а изменения БД выполняются только при server env `DEV_TOOLS_ENABLED="true"`.
- После изменения frontend-кода, Edge Functions или server env нужно перезапустить `npm run dev:telegram`.
- После существенных изменений стоит запускать минимум `pnpm lint`.

## Документация проекта

Дополнительный контекст лежит в:

- `AGENTS.md` — правила работы в репозитории и текущий статус.
- `GIT_POLICY.md` — строгая политика Git для AI-агентов.
- `docs/agents/LOCAL_TELEGRAM_RUN.md` — подробный локальный запуск внутри Telegram.
- `docs/agents/DESIGN_SYSTEM.md` — актуальная дизайн-система приложения.
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
- `notes/subscriptions.md` — MVP-модель подписок.
- `notes/home-progress-and-toast.md` — прогресс главного экрана и toast-сообщения.
- `notes/dev-mode-dx.md` — локальный Telegram-режим разработки и ограничения DX.
- `notes/production-readiness.md` — что нужно пересмотреть перед production.
