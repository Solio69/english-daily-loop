# План: F16 — отчёты об ошибках и диагностика

**Спецификация:** [spec.md](spec.md)
**Контракт:** [contracts/support-report.md](contracts/support-report.md)
**Основной обзор:** `D:\anastasiaStorage\Проекты\English daily loop\_work\F16 — Отчёты об ошибках и диагностика.md`
**Ветка / remote:** `refactor/release-1.1` / `origin`

## Архитектура

HTTP handler оставляет CORS/POST, env, Telegram `initData`, request ID и безопасный ответ. `support-report-flow.ts` проверяет обязательный комментарий, подготавливает snapshot и вызывает зависимости в порядке auth-user → sanitize → persist. `support-report-repository.ts` находит профиль по проверенному Telegram ID и вызывает RPC `submit_support_report` через service client; mapping стабильного DB-сигнала `SUPPORT_REPORT_RATE_LIMITED` даёт 429. Сырые DB errors не логируются. `sanitize-diagnostics.ts` владеет whitelist, redaction, бюджетом размера. Клиентский `clientLogger.ts` очищает известные секретные шаблоны до записи в sessionStorage. Форма и сервис отправки сохраняют API.

Postgres RPC принимает только внутренний user UUID, роль и очищенные поля. `SELECT ... FOR UPDATE` блокирует строку `public.users`, затем единый `clock_timestamp()` задаёт границу скользящего часа и `created_at` новой строки. Счётчик и insert выполняются в одной транзакции. Права execute отозваны у `PUBLIC`, `anon`, `authenticated`; `service_role` получает execute. Текущие table RLS/grants не меняются.

## Данные и rollout

Миграция `20261020120000_atomic_support_report_submission.sql` создаёт только RPC. Server-only function включается в version-aware backup policy/recovery validation и тесты; `notes/backup-and-restore.md` документирует новый contract. Новый Edge Function требует RPC: владелец применяет локальную миграцию до dev-бота, а production rollout и backup/recovery выполняет отдельно. Агент не применяет миграцию и не вызывает mutating DB commands. Размер 100 KiB, retention 30 дней, форма и пользовательские тексты сохраняются. Пакетная версия — `1.1.16`, опубликованные release metadata — F17.

## Проверка конституции C1–C8

C1/C2: строгий лимит и whitelist с redaction согласованы владельцем. C3/C6: каталог `specs/017-f16-support-diagnostics`, явный `ExpectedFeatureDirectory`, read-only analyze. C4: один проверенный commit F16 и обычный push в назначенную ветку. C5: server/client tests, SQL/backup contract, quality gates, staged diff и реальные статусы. C7: service-only RPC, никакие миграции/DB mutations агентом не запускаются. C8: UI, retention и продуктовый поток сохраняются; F17 отдельно.

## Шаги

1. Зафиксировать тестами текущий пользовательский поток, безопасный ответ, размеры и минимизацию данных; добавить ожидаемые тесты whitelist/redaction и RPC contract.
2. Подготовить server-only миграцию с блокировкой пользователя и атомарным count+insert; обновить backup policy, version gate, tests и документацию.
3. Выделить flow/repository из Edge handler; настроить mapping 429 и безопасные логи. Санитизировать по [контракту](contracts/support-report.md) до RPC.
4. Ужесточить локальный буфер clientLogger и тесты. Не менять вид формы и существующие тексты.
5. Запустить typecheck, lint, format, styles, legacy/Vitest/Deno, браузерные тесты и build; повторный read-only analyze, ревью доступа/секретов/SQL, `verification.md`.
6. Поднять patch-версию, проверить branch/remote/outgoing/staged diff, сделать один commit F16 и push. После коммита обновить обзор и карту.

## Проверки и передача

Использовать локальные установленные инструменты; pnpm shim при необходимости заменяется прямым запуском bundled Node. Нет нового ПО. Runtime SQL concurrency невозможно подтвердить без изменения локальной БД агентом; статус NotRun до действий владельца. Передать одну локальную команду миграции с объяснением, дождаться её результата до зависимой dev-проверки. Production команды изменения БД не давать без отдельного прямого запроса.
