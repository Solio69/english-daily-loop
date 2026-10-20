# Проверка F10

**Дата:** 2026-10-20. **Ветка:** `refactor/release-1.1`.

| Проверка | Результат |
| --- | --- |
| Deno check/lint/test (`test:edge`) | Passed: 20 Edge entrypoint, 92 lint files, 45 tests. |
| Legacy + Vitest (`test`) | Passed: 225 + 9 tests. |
| Playwright (`test:e2e`) | Passed: 5 tests с mocked API. |
| `typecheck`, `lint`, `format:check`, `lint:styles`, `build` | Passed. |
| Read-only SQL contract review | Passed: `get_or_create_vocabulary_review_state` и `review_vocabulary_word` сохраняют service_role grants, advisory/row locks, DB timestamp/date, очередь и интервалы; SQL не менялся. |
| Code/security review | Passed: Telegram auth и service role остались в HTTP слое, RPC получает внутренний user ID; секреты/DB-команды не добавлены. |
| Ручной dev-бот и реальная DB-конкуренция | NotRun: выполняет владелец. |

`tests/studyDateArchitecture.test.ts` читает выделенный сервис ответа. Замок SQL сериализует конкурентные действия, но повторный допустимый ответ может примениться ещё раз. Клиентский guard этого случая входит в F11. `release:check` не служит gate feature commit, поскольку release metadata остаётся 1.0.0 до выпуска владельцем.
