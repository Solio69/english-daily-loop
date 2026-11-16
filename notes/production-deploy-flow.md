# Production deploy flow

## Purpose

Этот runbook описывает ручной production-релиз схемы `Supabase Cloud + Vercel`.

Состав и порядок выпуска `1.0.0` зафиксированы в `notes/releases/1.0.0.md`.

Главная идея: frontend деплоится как Vite static build на Vercel, а backend/data слой живет в Supabase Cloud: Postgres, RLS/grants, RPC, Edge Functions, secrets и logs. На Supabase Free production БД защищается отдельным локальным logical backup по `notes/backup-and-restore.md`.

## Обновление работающего production

Phase 1, 2 и 6 ниже описывают первоначальное создание Supabase/Vercel. При обновлении уже работающей версии эти операции не повторяются. Состав и owner-run порядок выпуска 1.1.17 находятся в [плане 1.1.17](releases/1.1.17.md). Текущий production commit, migration history и pending SQL подтверждаются по фактическим системам до действий с БД; локальная ветка или backup manifest их не заменяют.

Для 1.1.17 владелец прямо решил пропустить новый isolated recovery drill. Это исключение из общего gate ниже; его статус NotRun, восстановимость свежего snapshot и RTO не подтверждены. Остальные требования к snapshot, dry run, postcheck, Edge/frontend порядку и Telegram smoke сохраняются.

## Official References

- Supabase CLI `db push`: https://supabase.com/docs/reference/cli/supabase-db-push
- Supabase CLI `functions deploy`: https://supabase.com/docs/reference/cli/supabase-functions-deploy
- Supabase Edge Function Secrets: https://supabase.com/docs/guides/functions/secrets
- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel system environment variables: https://vercel.com/docs/environment-variables/system-environment-variables
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

## Safety Rules

- Не записывать реальные секреты в notes, README, AGENTS, issue text, screenshots или чат.
- Не класть server-only секреты в Vercel `VITE_*` env.
- Не менять production schema вручную через Supabase Dashboard, если изменение должно жить в коде. Schema source of truth: `supabase/migrations`.
- Не использовать `supabase db reset --linked` для production.
- Перед применением миграций на production сначала смотреть dry run.
- Первый деплой выполняется вручную владельцем проекта, без автоматического CI/CD применения миграций.
- Исполняемые команды применения production-миграций в этом runbook не приводятся: владелец выполняет их только по отдельно проверенной operational-процедуре.
- Release PR можно открыть до production-действий, но merge в `main` выполняется только после успешных migration, postcheck, нового snapshot и деплоя Edge Functions. Recovery drill также обязателен, кроме явно согласованного и записанного исключения для конкретного выпуска. Если Vercel автоматически публикует `main`, merge запускает frontend deployment.
- Tag и GitHub Release создаются только после успешного production smoke.

## Phase 0: Local Preflight

Перед production-действиями локальная рабочая версия должна проходить базовые проверки:

```bash
pnpm release:check
pnpm lint
pnpm test
pnpm build
pnpm build:telegram
pnpm backup:status
```

Проверить, что:

- последние изменения закоммичены владельцем проекта;
- в локальных env-файлах, логах и screenshots нет production secrets;
- список production env актуален в `notes/production-env.md`;
- smoke checklist подготовлен до переключения frontend deployment или изменения BotFather URL.
- есть свежий завершенный production snapshot; critical-статус backup блокирует действия с риском потери данных;
- recovery drill подтвердил восстановимость текущего snapshot либо исключение для выпуска явно согласовано, записано как NotRun и риск принят владельцем;
- `package.json`, `src/constants/currentRelease.ts` и `CHANGELOG.md` содержат одну версию и дату релиза;
- секция `Unreleased` сохранена для следующих изменений.

## Phase 1: Supabase Cloud Project

1. Создать Supabase Cloud project.
2. Выбрать стабильный доступный регион, предпочтительно европейский.
3. Сохранить database password в password manager.
4. Скопировать production Project URL: `https://<project-ref>.supabase.co`.
5. Скопировать production anon key для frontend.
6. Проверить, что в проекте доступны Edge Functions и logs. Для Supabase Free использовать локальную backup-стратегию из `notes/backup-and-restore.md`.

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

## Phase 3: Review And Apply Database Migrations

Этот этап относится к production БД. Исполняемые команды намеренно не указаны.

Владелец проекта:

1. Сверяет список migration-файлов релиза с release scope.
2. Получает dry-run через утвержденную production operational-процедуру.
3. Проверяет порядок, ожидаемые locks, совместимость с предыдущим frontend и forward-fix план.
4. Проверяет локальный backup-статус и recovery gate по `notes/backup-and-restore.md`.
5. Применяет только согласованные миграции через утвержденную процедуру.
6. Не продолжает rollout при неожиданном SQL, расхождении migration history, critical backup status, непроверенном restore flow или отсутствии forward-fix плана.

После применения проверить в Supabase Dashboard:

- таблицы `public.users`, `public.user_settings`, reading/vocabulary/support таблицы существуют;
- RLS включен на защищенных таблицах;
- scheduled cleanup jobs для AI attempts, vocabulary attempts и support reports созданы;
- нет неожиданных ошибок в database logs.

## Phase 4: Configure Supabase Edge Function Secrets

Для уже работающего production владелец сверяет имена существующих секретов и меняет только согласованные значения. Значения вводятся напрямую из менеджера паролей в Supabase Dashboard → Edge Functions → Secrets; не помещать их в аргументы CLI, историю shell, чат или документацию. [Официальный порядок Supabase](https://supabase.com/docs/guides/functions/secrets).

Проверить наличие server-only значений:

- OPENROUTER_API_KEY — ключ AI-провайдера;
- TELEGRAM_BOT_TOKEN — токен production-бота;
- TELEGRAM_BOT_WEBHOOK_SECRET — отдельный секрет webhook, 32–256 символов из допустимого алфавита;
- DEV_TOOLS_ENABLED — действующий флаг доступности admin-инструментов;
- SUBSCRIPTION_FLOW_ENABLED — false, пока оплата скрыта;
- OPENROUTER_MODEL_CHAIN — только если нужна фиксированная согласованная цепочка моделей.

При замене токена или webhook secret согласовать значение Supabase с owner-run настройкой production-бота через hidden prompts и сразу проверить auth/webhook. Не сбрасывать pending updates для существующего бота без отдельной причины. После сохранения проверить наличие имён секретов и ошибки Edge Functions, не выводя сами значения.
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
npx supabase functions deploy delete-pending-vocabulary-word
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
npx supabase functions deploy telegram-bot-webhook
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
- Vercel deployment связан с ожидаемым Git commit;
- в настройках отображается номер из `package.json`;
- support report содержит `environment = production` и ожидаемый Vercel Git SHA в `buildId`.

## Phase 8: Telegram Bot и webhook

1. В BotFather включить Main Mini App production-бота с Vercel production URL. Preview screenshots/video в текущий scope не входят.
2. Убедиться, что `telegram-bot-webhook` уже задеплоена, а `TELEGRAM_BOT_WEBHOOK_SECRET` задан в Supabase Cloud.
3. Из корня release checkout запустить helper. Параметры содержат только публичные URL; production token и тот же webhook secret helper запросит скрыто:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/telegram/configure-production-bot.ps1 -Mode Configure -MiniAppUrl "https://english-daily-loop.vercel.app" -WebhookUrl "https://<project-ref>.supabase.co/functions/v1/telegram-bot-webhook" -DropPendingUpdates
```

`-DropPendingUpdates` использовать при первой регистрации, чтобы старые unanswered updates не получили запоздалые ответы. При последующих обновлениях этот switch по умолчанию не указывать.

Helper перед mutations проверяет точный username `@english_daily_loop_bot`, применяет display name/descriptions, private commands, default menu button `Открыть приложение`, webhook с `allowed_updates = ["message"]` и выводит безопасный `getWebhookInfo` без credentials.

Telegram Mini App получает настоящий `initData` только внутри Telegram WebView, поэтому финальная проверка auth выполняется именно там.

## Phase 9: Production Smoke

Минимальный smoke после настройки production-бота:

- profile показывает `English Daily Loop` и согласованные descriptions;
- `/start`, `/help` и обычный текст получают согласованные ответы с inline button `Открыть приложение`;
- inline button, default menu button и Main Mini App открывают один production frontend URL;

- новый пользователь открывает приложение и проходит Telegram auth;
- настройки сохраняются;
- главный экран открывается без ошибок;
- генерация текста работает;
- текст завершается и попадает в материалы;
- слово сохраняется из текста;
- карточки словаря готовятся;
- повторение слов открывается и принимает действие интервала;
- отчет об ошибке отправляется и появляется в `public.support_reports`;
- карточка версии показывает текущий номер, а `Что нового` открывает последний release note;
- support report содержит ожидаемые `appVersion`, `buildId`, `environment`;
- admin видит dev tools, tester/user не видит dev tools;
- subscription entry скрыт.

При необходимости rollback сначала удалить webhook, не передавая token в аргументах:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/telegram/configure-production-bot.ps1 -Mode DeleteWebhook -DropPendingUpdates
```

После `deleteWebhook` default menu button и Main Mini App продолжают открывать production frontend.

Подробный чеклист для ручной проверки хранится в `notes/production-smoke-checklist.md`.

## Phase 10: Tag And GitHub Release

Только после успешного production smoke владелец читает текущую версию из `package.json`, формирует tag `v<package.json.version>` и фиксирует им проверенный production commit. Агент эти Git-команды не выполняет.

```powershell
$releaseVersion = node -p "require('./package.json').version"
$releaseTag = "v$releaseVersion"
$productionCommitSha = "REPLACE_WITH_PRODUCTION_COMMIT_SHA"
git tag -a $releaseTag $productionCommitSha -m "Release $releaseTag"
git push origin $releaseTag
```

GitHub Release создается владельцем из того же `$releaseTag`; описание курируется по соответствующей версии секции в `CHANGELOG.md`:

```powershell
$releaseNotesFile = "REPLACE_WITH_RELEASE_NOTES_FILE"
gh release create $releaseTag --title $releaseTag --notes-file $releaseNotesFile
```

Номер tag всегда совпадает с `package.json.version`. Если production smoke не пройден, tag и GitHub Release не создаются; исправление выпускается отдельным следующим SemVer.

## Rollback

Frontend rollback:

- использовать previous deployment в Vercel.

Edge Functions rollback:

- redeploy функций из предыдущего стабильного commit.

Database rollback:

- не делать ручной откат production DB без отдельного плана;
- для schema-проблем предпочтителен forward-fix миграцией;
- для data-проблем восстанавливать snapshot сначала в изолированную БД и только затем готовить отдельный план выборочного восстановления;
- не восстанавливать logical dump поверх production БД.

## Related Docs

- `notes/deployment-platform-decision.md`
- `notes/production-env.md`
- `notes/production-smoke-checklist.md`
- `notes/production-readiness.md`
- `notes/backup-and-restore.md`
- `notes/server-side-data-guards.md`
- `notes/security-threat-model.md`
- `CHANGELOG.md`
