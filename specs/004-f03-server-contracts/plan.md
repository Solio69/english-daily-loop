# План: F03 — общие серверные контракты

**Спецификация:** [spec.md](spec.md)

**Ветка/remote:** `refactor/release-1.1` / `origin`

## Решение

Оставляем текущие helpers `server.ts` и `app.ts`. Новый `parseJsonObjectBody` читает JSON как `unknown`, отбрасывает `null`, массивы и примитивы, затем возвращает `Record<string, unknown>`. Существующий `parseJsonBody<T>` не меняем: его используют другие функции, перевод которых вне F03. `get-reading-history` и `save-reading-position` применяют новый helper; read handler также переходит на `createServiceClient`. Оба сохраняют свой порядок проверки env/auth, запросы, ответы и статусы. Для общей границы — Deno unit/contract tests без сети/БД.

## Обоснование

Это сохраняет внешний API, не вводит framework/пакеты, задаёт проверяемый образец постепенного перехода. Отдельная runtime-проверка структуры полей остаётся в обработчике. Пустой JSON-объект проходит общую границу, после чего `getTelegramUserFromBody` возвращает прежний `INIT_DATA_REQUIRED`.

## Конституция

C1: код прочитан; C2: обзор и ветка согласованы; C3: явный каталог `004-f03-server-contracts`; C4: один коммит после F02, версия 1.1.3; C5: проверки ниже; C6: отдельный read-only analyze; C7: без БД-команд/секретов; C8: только общая граница и два образца.

## Файлы и порядок

1. `supabase/functions/_shared/server.ts`: проверка объектного тела и код `INVALID_BODY` для других корневых JSON-типов.
2. `supabase/functions/get-reading-history/index.ts` и `save-reading-position/index.ts`: использование проверенного объекта; общий service client в чтении. `@ts-nocheck` снять после Deno typecheck. В `_shared/app.ts` и `_shared/vocabulary-card-generation.ts` явно возвращать `fail(...)` в ветках ошибки, чтобы сужение типов проверялось Deno без смены поведения.
3. Добавить отдельный `supabase/functions/_shared/server-contracts.test.ts`: корректный объект, массив/null/примитив, неверный JSON, отсутствие `initData`, безопасный ответ. Так тесты F02/F03 попадут в разные коммиты.
4. Зафиксировать `deno.lock`, созданный проверкой существующего Supabase import, для воспроизводимого Deno typecheck. Проверки, review контрактов, `verification.md`, версия 1.1.3 и один коммит/push после успешной F02.

## Проверки

`pnpm test:edge`, Deno typecheck выбранных Edge Functions, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm test`, `pnpm test:e2e`, `pnpm build`; staged diff и секреты перед коммитом. Production и локальные данные не меняются.
