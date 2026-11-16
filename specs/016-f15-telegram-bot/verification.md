# Проверки F15

**Дата:** 2026-10-20. **Ветка:** `refactor/release-1.1`. **Версия:** `1.1.15`.

| Проверка | Статус | Результат |
| --- | --- | --- |
| Целевые Telegram Node-тесты | Passed | 16/16, подставной fetch и синтетические значения. |
| TypeScript | Passed | `node node_modules/typescript/bin/tsc --noEmit`. |
| ESLint | Passed | `node scripts/quality/check-code.mjs lint`. |
| Prettier | Passed | `node scripts/quality/check-code.mjs format`. |
| Stylelint | Passed | `node scripts/quality/check-code.mjs styles`. |
| Legacy tests | Passed | 239/239 через bundled tsx; TEMP/TMP направлены в gitignored `tools/f15-test-temp`. |
| Vitest | Passed | 25/25. |
| Deno typecheck/lint/tests | Passed | 60/60, `node scripts/quality/run-deno.mjs`. |
| Production build | Passed | Vite build после повышения версии; предупреждение о существующем основном чанке 527.90 kB. |
| `git diff --check` | Passed | Ошибок whitespace нет. |
| `pnpm typecheck` | Failed | Системный Volta shim не запускается: `volta` не найден; прямой локальный TypeScript прошёл. |
| `release:check` | Failed, ожидаемо до F17 | Published metadata 1.0.0 и заголовок CHANGELOG не соответствуют рабочей 1.1.15. |
| Ручной dev-бот | NotRun | Владелец проверит `/start`, `/help`, неизвестную команду и кнопку Mini App. |
| Production helper | NotRun | Только владелец при выпуске; агент не запускал. |

Первый запуск legacy-набора в системной temp-папке завершился EPERM на rename тестовых backup-файлов. Повтор в локальной gitignored temp-папке прошёл полностью. Тесты не подключались к Telegram API или БД и не меняли данные.
