# План: F02 — сквозной тестовый контур

**Спецификация:** [spec.md](spec.md)\
**Основной обзор:** `D:\anastasiaStorage\Проекты\English daily loop\_work\F02 — Сквозной тестовый контур.md`\
**Ветка владельца:** `refactor/release-1.1`\
**Remote:** `origin`

## Решение и основания

Браузерные тесты используют полный Chromium в новом headless-режиме (`channel: chromium`); в CI устанавливается браузер без отдельного headless shell.

Playwright поднимает Vite dev server с фиктивными `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`. Test fixture задаёт Telegram WebApp через `addInitScript`, блокирует внешнюю сеть и подменяет `/functions/v1/*`; проверяет успешный bootstrap и отказ auth. Deno test проверяет чистые shared helpers (`moscow-study-date`, `reading-text`, HTTP response/guard) без БД и секретов. DB/RLS-файл в `supabase/tests/database/` запускается только владельцем через wrapper: он сверяет project ID из `supabase/config.toml` и local DB URL от `supabase status`, затем вызывает `supabase test db --local <file>`. pgTAP в CLI оборачивает файл в откатываемую транзакцию; SQL до INSERT проверяет базу, таблицы и свободный fixture ID. CI расширяется Playwright Chromium + Deno, без DB.

## Контекст

Текущий frontend: `src/App.tsx` → `useAppUserProfile` → `auth-telegram` через Supabase Functions; в `src/lib/supabase.ts` URL и anon key берутся из Vite env. Текущая local DB в `supabase/config.toml`: project `english-daily-loop`, API 54321, DB 54322; пользователи и защищённые таблицы закрыты от anon/authenticated. Deno CLI отсутствует; одобрен локальный бинарник в gitignored `tools/`, в CI — `denoland/setup-deno@v2`. Playwright dev-зависимость согласована; браузер только Chromium. Продуктовые зависимости не обновляются.

## Проверка конституции

C1: факты проверены по frontend, migrations и config; выборы владельца в обзоре. C2: обзор и ветка утверждены; новое существенное решение возвращается. C3: явный каталог `003-f02-e2e-test-harness`, полный пакет. C4: один коммит F02 только после owner-run DB/RLS, версия 1.1.2; до этого код может оставаться незакоммиченным. C5: автоматические/ручные проверки и verification. C6: отдельный read-only analyze. C7: агент не выполняет DB-mutating команду, не использует реальные секреты. C8: только тестовый контур, продуктовый код не меняется.

## Дополнительные документы

Модель данных и новые API-контракты не нужны. Инструкция owner-run DB/RLS находится в Obsidian обзоре и `verification.md`; SQL тест сам проверяет контекст запуска. README/quickstart отдельно не нужен.

## План файлов и шагов

1. Установить согласованный `@playwright/test` и Chromium локально, Deno CLI — в gitignored `tools/`; зафиксировать совместимые версии/lockfile.
2. Добавить `playwright.config.ts`, test fixtures и browser success/error tests; package script `test:e2e`.
3. Добавить Deno tests в `supabase/functions/_shared/*.test.ts` или выделенную тестовую папку; package script `test:edge`, без импортов из сети.
4. Добавить pgTAP DB/RLS SQL с уникальным fixture, `--local` wrapper и предусловиями, без общего reset; подготовить одну команду владельцу после F01–F04. Внутри контейнера Postgres слушает 5432, поэтому SQL не проверяет внешний порт 54322; его проверяет wrapper по local DB URL.
5. Обновить CI, запустить все доступные проверки, записать `verification.md` с DB NotRun; затем готовить F03/F04. После подтверждённого DB-прогона владельцем поднять версию 1.1.2, выполнить все обязательные проверки и сделать один F02 commit/push, затем коммиты F03/F04 по порядку.

## Проверки

`pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm test`, `pnpm test:e2e`, `pnpm test:edge`, `pnpm build`, Git diff/check и review. Deno test без сети и env. DB/RLS: одну команду wrapper из `scripts/quality/` выполняет только владелец; до вывода — NotRun и commit заблокирован. CI после push проверяется отдельно. `release:check` относится к опубликованному выпуску.
