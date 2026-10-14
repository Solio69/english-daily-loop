# Проверка F04

**Статус:** локальные проверки пройдены; поставка F04 фиксируется отдельным коммитом после F03.

| Проверка | Результат |
| --- | --- |
| `pnpm test` | Passed: 210 Node + 2 Vitest с локальным `TEMP` |
| Подставные тесты OpenRouter | Passed: 429/500 без повтора, bad-content retry, timeout, invalid JSON, безопасная диагностика, общий бюджет карточек |
| `deno check` transport, diagnostics и двух AI pipelines | Passed 2026-10-14 |
| `deno lint` файлов F04 | Passed: 6 файлов; для существующего закреплённого `https:` import исключено `no-import-prefix`, для двух legacy handlers с прежним `@ts-nocheck` — `ban-ts-comment` |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm build` | Passed локально 2026-10-14 |
| `pnpm test:e2e` | Passed: 2 сценария с подставным API в полном Chromium |
| GitHub CI | NotRun: исходящий коммит F04 ещё не проверен GitHub |

Два legacy handler-файла всё ещё содержат `@ts-nocheck`: их полный `deno check` выявил 29 ранее скрытых ошибок типов. Удаление подавления требует отдельной фичи; изменённые transport, diagnostics и pipelines проверены Deno.

Версия F04: `1.1.4`. Проверить F04 staged diff и выполнить один commit/push F04.
