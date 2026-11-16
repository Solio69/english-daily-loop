# Проверка F02

**Статус:** локальные проверки и owner-run DB/RLS пройдены; поставка фичи фиксируется отдельным коммитом в назначенной ветке.

| Проверка | Результат |
| --- | --- |
| `pnpm typecheck`, `pnpm lint`, `pnpm lint:styles`, `pnpm build` | Passed локально 2026-10-14 |
| `pnpm format:check` | Passed после итогового повтора перед коммитом |
| `pnpm test` | Passed: 210 Node + 2 Vitest; тестовый `TEMP` установлен в gitignored `tools/test-temp` из-за EPERM системной sandbox temp |
| `pnpm test:edge` | Passed: 9 Deno-тестов (F02 и F03 вместе) |
| `pnpm test:e2e` | Passed после итогового повтора: 2 браузерных сценария в полном Chromium (`channel: chromium`), локальные Telegram/API mocks, внешний запрос не прошёл |
| `scripts/quality/run-local-db-check.ps1` | Passed: владелец запустил на `127.0.0.1:54322/postgres`; pgTAP 11/11, `Result: PASS`, тестовая транзакция откатилась |
| GitHub CI | NotRun: F02 ещё не отправлена |
| `pnpm release:check` | NotRun: проверка опубликованного выпуска, не ветки 1.1.x |

Версия F02: `1.1.2`. Проверить staged diff/секреты и выполнить один commit/push F02.
