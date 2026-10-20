# Проверка F08 — жизненный цикл слова на сервере

Дата: 2026-10-20. Ветка: `refactor/release-1.1`. Версия пакета: `1.1.8`.

## Реализация

Сохранение и удаление pending-слова разделены на HTTP/auth (`index.ts`), входной контракт и отображение ошибок, предметный сценарий и Supabase/RPC-адаптер. Входные правила save/delete сохранены раздельно. Адаптеры проверяют форму активного текста и RPC-ответа до использования; повреждённый ответ даёт безопасную 500. SQL RPC остаются владельцами атомарной проверки active text, статуса, лимита, удаления sources и lock. Схема, миграции, grants, дизайн, клиентское поведение и новые пакеты не затронуты.

## Проверки

| Проверка | Результат |
| --- | --- |
| Deno `check`/`lint`/shared tests через `scripts/quality/run-deno.mjs` | Passed: 29 shared tests, включая 11 новых F08 |
| `tsx --test tests/*.test.ts`, TEMP/TMP внутри проекта | Passed: 225 тестов |
| `vitest run` | Passed: 9 тестов |
| `playwright test` с доступом к локальному loopback | Passed: 5 тестов |
| `tsc --noEmit` | Passed |
| `check-code.mjs lint` | Passed |
| `check-code.mjs format` | Passed |
| `check-code.mjs styles` | Passed |
| `vite build` | Passed; прежнее предупреждение о размере общего JS chunk |
| `git diff --check` | Passed |
| `release:check` (read-only, вне обязательных gates фичи) | Failed ожидаемо: веточная patch-версия 1.1.8 не равна release metadata 1.0.0; changelog 1.1.8 не опубликован |

Использованы уже установленные локальные бинарники: `pnpm` shim Volta в этой среде недоступен. Первая попытка legacy tests без переноса TEMP и первая попытка Playwright внутри песочницы были остановлены ограничениями файловой системы и loopback; повторные проверки прошли. DB-mutation, миграции, dev-бот и реальный AI агентом не запускались. Ручная приёмка владельца ожидается.

## Review

Проверены сохранение числового индекса и строгий тип индекса удаления, active text/word check до RPC, порядок level/limit/save, коды конфликта/лимита, request ID удаления, обработка повреждённого RPC-результата, server-only grants и advisory lock в действующем SQL. Секреты не добавлены; прямой клиентской записи в защищённые таблицы нет. FR/AC, plan, tasks и diff согласованы; блокирующих замечаний нет.
