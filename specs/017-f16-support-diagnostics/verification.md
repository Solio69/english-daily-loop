# Проверки F16

**Дата:** 2026-10-20. **Ветка:** `refactor/release-1.1`. **Версия:** `1.1.16`.

| Проверка | Статус | Результат |
| --- | --- | --- |
| `node node_modules/typescript/bin/tsc --noEmit` | Passed | Ошибок типов нет. |
| `node scripts/quality/check-code.mjs lint` | Passed | ESLint прошёл. |
| `node scripts/quality/check-code.mjs format` | Passed | Prettier проверил изменённые и новые файлы. |
| `node scripts/quality/check-code.mjs styles` | Passed | CSS проверен. |
| `node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts` | Passed | 242 теста. Для Windows временные файлы направлены в gitignored `tools/f16-test-temp`. |
| Vitest | Passed | 25 тестов. |
| `node scripts/quality/run-deno.mjs` | Passed | Deno typecheck/lint и 65 тестов. |
| `node node_modules/@playwright/test/cli.js test` | Passed | 17 браузерных сценариев, включая отправку отчёта из формы. |
| Vite production build | Passed | Сборка создана; предупреждение о размере JS bundle 528.25 kB не блокирует F16. |
| `git diff --check` | Passed | Ошибок пробелов нет. |
| `git diff --cached --check` и просмотр списка/stats staged файлов | Passed | Только 25 файлов F16; ошибок пробелов нет. |
| `node node_modules/tsx/dist/cli.mjs --test tests/personalDataMinimization.test.ts` после финального уточнения redaction | Passed | 14 тестов, включая JSON-пары в комментарии. |
| `node node_modules/typescript/bin/tsc --noEmit` после уточнения | Passed | Ошибок типов нет. |
| `node scripts/quality/check-code.mjs format` после уточнения | Passed | Формат сохранён. |
| `release:check` | Failed, ожидаемо вне F16 | Публикуемые release metadata/CHANGELOG пока 1.0.0; пакет 1.1.16. Согласованный scope F17. |
| Применение миграции `20261020120000` и runtime-конкуренция в локальном Postgres | NotRun | Агенту запрещены миграции и изменяющие DB команды; выполняет владелец. |
| Ручная приёмка в dev-боте | NotRun | Требует сначала локальной миграции владельца. |

Проверены SQL-порядок блокировки/времени/count/insert, права RPC, version-aware backup/recovery contract, отсутствие raw DB errors и отчёта в логах. Секреты и чужие изменения в коммит не включаются. `pnpm` shim в среде не запускается из-за недоступного `volta`; эквивалентные команды выполнены через установленные локально Node-инструменты.
