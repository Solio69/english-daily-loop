# Production deploy flow

## Purpose

Этот runbook описывает ручной первый production-деплой схемы `Supabase Cloud + Vercel`.

Главная идея: frontend деплоится как Vite static build на Vercel, а backend/data слой живет в Supabase Cloud: Postgres, RLS/grants, RPC, Edge Functions, secrets, logs и backups.

## Official References

- Supabase CLI `db push`: https://supabase.com/docs/reference/cli/supabase-db-push
- Supabase CLI `functions deploy`: https://supabase.com/docs/reference/cli/supabase-functions-deploy
- Supabase CLI `secrets set`: https://supabase.com/docs/reference/cli/supabase-secrets-set
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel environment variables: https://vercel.com/docs/environment-variables

## Safety Rules

- Не записывать реальные секреты в notes, README, AGENTS, issue text, screenshots или чат.
- Не класть server-only секреты в Vercel `VITE_*` env.
- Не менять production schema вручную через Supabase Dashboard, если изменение должно жить в коде. Schema source of truth: `supabase/migrations`.
- Не использовать `supabase db reset --linked` для production.
- Перед применением миграций на production сначала смотреть dry run.
- Первый деплой выполняется вручную владельцем проекта, без автоматического CI/CD применения миграций.

## Phase 0: Local Preflight

Перед production-действиями локальная рабочая версия должна проходить базовые проверки:

```bash
pnpm lint
pnpm test
pnpm build
```

Проверить, что:

- последние изменения закоммичены владельцем проекта;
- в локальных env-файлах, логах и screenshots нет production secrets;
- список production env актуален в `notes/production-env.md`;
- smoke checklist подготовлен до переключения BotFather URL.

## Phase 1: Supabase Cloud Project

1. Создать Supabase Cloud project.
2. Выбрать стабильный доступный регион, предпочтительно европейский.
3. Сохранить database password в password manager.
4. Скопировать production Project URL: `https://<project-ref>.supabase.co`.
5. Скопировать production anon key для frontend.
6. Проверить, что в проекте доступны Edge Functions, logs и нужный план backups.

После создания проекта не переносить данные вручную через UI. Схема накатывается миграциями.

## Phase 2: Link Local CLI To Production Project

Команды выполняются владельцем проекта из корня репозитория:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <project-ref>
```

`<project-ref>` берется из Supabase project URL или dashboard. При `link` CLI может запросить database password.

## Phase 3: Apply Database Migrations

Сначала посмотреть, какие миграции будут применены:

```bash
npx supabase db push --dry-run
```

Если список миграций ожидаемый, применить:

```bash
npx supabase db push
```

После применения проверить в Supabase Dashboard:

- таблицы `public.users`, `public.user_settings`, reading/vocabulary/support таблицы существуют;
- RLS включен на защищенных таблицах;
- scheduled cleanup jobs для AI attempts, vocabulary attempts и support reports созданы;
- нет неожиданных ошибок в database logs.

## Phase 4: Configure Supabase Edge Function Secrets

Server-only значения задаются в Supabase secrets, не в Vercel:

```bash
npx supabase secrets set OPENROUTER_API_KEY="<production-openrouter-key>"
```

```bash
npx supabase secrets set TELEGRAM_BOT_TOKEN="<production-telegram-bot-token>"
```

```bash
npx supabase secrets set DEV_TOOLS_ENABLED="true"
```

```bash
npx supabase secrets set SUBSCRIPTION_FLOW_ENABLED="false"
```

Если нужна фиксированная цепочка моделей:

```bash
npx supabase secrets set OPENROUTER_MODEL_CHAIN="<comma-separated-allowlisted-models>"
```

Для первого production testing period `DEV_TOOLS_ENABLED="true"` намеренно разрешен, но действия все равно требуют `users.app_role = 'admin'` на сервере.

## Phase 5: Deploy Supabase Edge Functions

Деплой всех локальных Edge Functions:

```bash
npx supabase functions deploy
```

Если CLI попросит деплоить функции по одной, использовать имена директорий из `supabase/functions`:

```bash
npx supabase functions deploy auth-telegram
npx supabase functions deploy save-user-settings
npx supabase functions deploy get-reading-state
npx supabase functions deploy generate-reading-text
npx supabase functions deploy complete-reading-text
npx supabase functions deploy get-reading-history
npx supabase functions deploy save-reading-position
npx supabase functions deploy save-vocabulary-word
npx supabase functions deploy get-vocabulary-state
npx supabase functions deploy get-vocabulary-words
npx supabase functions deploy prepare-vocabulary-cards
npx supabase functions deploy get-vocabulary-review-state
npx supabase functions deploy review-vocabulary-word
npx supabase functions deploy dev-tools
npx supabase functions deploy submit-support-report
npx supabase functions deploy activate-subscription
npx supabase functions deploy approve-vocabulary-card
npx supabase functions deploy approve-vocabulary-cards
```

После деплоя проверить в Supabase Dashboard, что функции появились и не падают на старте из-за отсутствующих env.

## Phase 6: Vercel Project

Создать Vercel project из репозитория.

Project settings:

```text
Framework Preset: Vite
Install Command: pnpm install
Build Command: pnpm build
Output Directory: dist
```

Production env в Vercel:

```env
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<production-anon-key>"
VITE_FEEDBACK_TELEGRAM_USERNAME="<telegram-username-without-at>"
```

После изменения Vercel env нужен новый deployment: старые deployments не получают новые env.

## Phase 7: Frontend Deploy

Запустить production deploy в Vercel из UI или через подключенный Git provider.

После деплоя открыть production URL в браузере и проверить:

- приложение грузится без белого экрана;
- нет видимых ошибок сборки;
- frontend обращается к production `VITE_SUPABASE_URL`, а не к локальному tunnel.

## Phase 8: Telegram BotFather

В BotFather:

1. Выполнить `/setmenubutton`.
2. Выбрать production bot.
3. Указать Vercel production URL.
4. Открыть bot menu в Telegram.

Telegram Mini App получает настоящий `initData` только внутри Telegram WebView, поэтому финальная проверка auth выполняется именно там.

## Phase 9: Production Smoke

Минимальный smoke после переключения BotFather URL:

- новый пользователь открывает приложение и проходит Telegram auth;
- настройки сохраняются;
- главный экран открывается без ошибок;
- генерация текста работает;
- текст завершается и попадает в материалы;
- слово сохраняется из текста;
- карточки словаря готовятся;
- повторение слов открывается и принимает действие интервала;
- отчет об ошибке отправляется и появляется в `public.support_reports`;
- admin видит dev tools, tester/user не видит dev tools;
- subscription entry скрыт.

Подробный чеклист для ручной проверки хранится в `notes/production-smoke-checklist.md`.

## Rollback

Frontend rollback:

- использовать previous deployment в Vercel.

Edge Functions rollback:

- redeploy функций из предыдущего стабильного commit.

Database rollback:

- не делать ручной откат production DB без отдельного плана;
- для schema-проблем предпочтителен forward-fix миграцией;
- для data-проблем сначала снять backup/dump и только потом выполнять согласованные SQL-действия.

## Related Docs

- `notes/deployment-platform-decision.md`
- `notes/production-env.md`
- `notes/production-smoke-checklist.md`
- `notes/production-readiness.md`
- `notes/server-side-data-guards.md`
- `notes/security-threat-model.md`
