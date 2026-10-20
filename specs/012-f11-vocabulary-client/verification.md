# Проверка F11

**Дата:** 2026-10-20. **Ветка:** `refactor/release-1.1`.

| Проверка | Результат |
| --- | --- |
| Deno check/lint/test (`test:edge`) | Passed: 20 Edge entrypoint, 92 lint files, 45 tests. |
| Legacy + Vitest (`test`) | Passed: 225 + 19 tests. |
| Playwright (`test:e2e`) | Passed: 7 tests; два сценария F11 в светлой и тёмной мобильной теме с mocked API. |
| `typecheck`, `lint`, `format:check`, `lint:styles`, `build` | Passed. |
| Визуальный review | Passed: screenshots двух тем 390×844; разметка и тексты сохранены, горизонтального переполнения нет. |
| Code/security review | Passed: запросы остаются через Edge Functions с Telegram initData; прямых DB-записей, новых секретов и пакетов нет. |
| Ручной dev-бот и Telegram WebView | NotRun: выполняет владелец. |

После успешной записи ответа и неудачной загрузки состояния старая карточка блокируется. Повреждённый успешный payload mutation трактуется как возможная успешная запись и также требует обновления очереди. `MaterialsScreen` и его навигация не менялись. `release:check` не служит gate feature commit, поскольку release metadata остаётся 1.0.0 до выпуска владельцем.

После разделения готового списка слов и переноса тестовых данных в fixture повторены typecheck и 10 целевых Vitest; итоговый браузерный сценарий запущен отдельно для обеих тем.
