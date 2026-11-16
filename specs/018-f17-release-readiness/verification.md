# Проверки F17

**Дата:** 2026-11-16. **Ветка:** refactor/release-1.1. **Кандидат:** 1.1.17, локальные изменения F17 без commit/push.
**Статус:** локальные проверки пройдены; контраст ниже AC-3 явно принят владелицей как ограничение 1.1.17. Production rollout и выпуск не подтверждены.

| Проверка | Статус | Факт |
| --- | --- | --- |
| Назначенная ветка и diff | Passed | Ветка refactor/release-1.1; README уже в отдельном локальном коммите e3b69e2. Изменения F17 остаются без commit/push. |
| pnpm typecheck | Passed | Ошибок типов нет. |
| pnpm lint | Passed | Проектный ESLint прошёл. |
| pnpm format:check | Passed | Изменённые файлы соответствуют проектному Prettier; повторная проверка прошла. |
| pnpm lint:styles | Passed | CSS проверен. |
| pnpm test:all | Passed | 242 Node, 25 Vitest, 18 Playwright и 65 Deno тестов прошли на финальном коде. |
| pnpm build | Passed с предупреждением | Основной JS 529,51 КБ / gzip 148,79 КБ; CSS 75,01 КБ / gzip 19,07 КБ. Vite предупреждает о чанке >500 КБ. До F17 JS был 528,29 КБ / gzip 148,48 КБ; порог не повышен. |
| pnpm build:telegram | Passed с предупреждением | Владелица подтвердила остановку dev-бота до сборки. Telegram bundle собран; основной JS 529,51 КБ / gzip 148,79 КБ; то же предупреждение Vite. |
| pnpm release:check | Passed | package.json, currentRelease и CHANGELOG согласованы: версия 1.1.17, целевая дата 2026-11-16. При переносе публикации дату обновить и повторить проверку. |
| pnpm backup:status | Passed | Snapshot 2026-11-16T110846Z_3eee596f, пять SQL-файлов и SHA-256 checksums проверены до миграции. |
| git diff --check | Passed | Ошибок пробелов нет; предупреждения касаются LF/CRLF рабочей копии. |
| Ручная dev-приёмка F14–F16 | Passed по подтверждению владелицы | 16.11 подтверждены команды бота, чтение и словарь, роли admin/user, отправка и лимит отчётов. Агент не выполнял эти сценарии в реальном Telegram. |
| Доступность | Accepted limitation по AC-3 | Фокус, Escape, подпись поля и live-сообщения окна отчёта исправлены; Playwright-сценарий прошёл. Исходные цвета восстановлены. Белый текст коралловой кнопки даёт около 2,7:1, приглушённый текст светлой карточки около 3,3:1 при критерии 4,5:1. Владелица 16.11 явно приняла это ограничение для 1.1.17; соответствие критерию не заявляется. |
| Безопасность и границы данных | Passed для статического обзора | Tracked env — только example-файлы; поиск известных форматов токенов вывел синтетический test fixture. Edge Function проверяет Telegram initData до сервисного вызова; RPC доступна только service_role. Реальный production RLS/grants/postcheck остаётся owner-run. |
| GitHub main | Passed | Live remote и локальная main совпали: c0951fef5fe7cf6e6149fbcd295188f892b08b5a, версия 1.0.0. Этот коммит является предком релизной ветки. |
| История миграций в snapshot | Passed для snapshot | В snapshot от 11:08 UTC 42 версии, ровно тот же набор, что в GitHub main; последняя — 20261016120000. Новая миграция 20261020120000 отсутствует. Это не подтверждает живую БД после snapshot. |
| Live migration history | Passed по выводу владелицы | `pnpm exec supabase migration list --linked` показала 42 совпадающие Local/Remote версии до 20261016120000; 20261020120000 есть только Local. Неожиданных версий в выведенном списке нет. |
| Migration dry run | Passed по выводу владелицы | `pnpm exec supabase db push --linked --dry-run` явно не применил миграции и показал ровно 20261020120000_atomic_support_report_submission.sql. |
| Production frontend commit SHA | NotRun | GitHub main не подтверждает фактический Vercel deployment; сверить до переключения frontend. |
| Новый recovery drill | NotRun по решению владелицы | Восстановимость свежего snapshot и RTO не подтверждены; это исключение из runbook, а не успешная проверка. |
| GitHub Actions / PR / merge / production smoke / tag | NotRun | Выполняются после owner-run commit/push и production rollout. |

## Ревью

Подтверждённые дефекты F17: модальное окно отчёта теряло фокус и не имело видимой подписи; тесты release-check зависели от старой опубликованной версии. Они исправлены. Исходная палитра светлой темы возвращена по просьбе владелицы; ранее измеренные нарушения контраста явно приняты как ограничение этого выпуска. Документация с устаревшими путями и процессом первого deploy исправлена. Секреты не помещались в diff или verification.

Перед изменением production остаются обязательными dry run, owner-run postcheck, snapshot после миграции, Edge deploy и production Telegram smoke; фактический Vercel SHA нужен до переключения frontend. Принятое ограничение контраста не подменяет эти проверки. Локальные проверки не доказывают успешность этих шагов.