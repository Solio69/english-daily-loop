# Задачи: F16 — отчёты об ошибках и диагностика

**Вход:** [spec.md](spec.md), [plan.md](plan.md), [contracts/support-report.md](contracts/support-report.md). **Статус:** код и автоматические проверки завершены; Git-передача и owner-run проверка отмечаются отдельно.

## Шаги

- [x] T001 [FR-001–005, AC-1–6] Добавить тесты server flow, whitelist/redaction, лимитов и безопасных ошибок на синтетических данных и подставных зависимостях.
- [x] T002 [FR-002/006, AC-3/4/7] Подготовить server-only SQL RPC и тест контракта блокировки, окна, прав и ответа; не применять миграцию.
- [x] T003 [FR-006, AC-7] Обновить version-aware backup/recovery contract, тесты и notes/backup-and-restore.md.
- [x] T004 [FR-001/002/005, AC-1–4] Выделить flow/repository, перевести handler на RPC, безопасно отобразить rate limit и убрать сырые данные из логов.
- [x] T005 [FR-003/004, AC-5/6] Ужесточить серверную санитизацию и client buffer по точному whitelist/redaction contract; обновить notes/support-diagnostics.md.
- [x] T006 [FR-007, AC-1–7] Провести quality gates, review SQL/секретов/схемы и staged diff, повторный read-only analyze; записать verification.md с NotRun для DB runtime.
- [ ] T007 [C4] Поднять версию до 1.1.16, проверить branch/remote/outgoing, сделать один commit F16 и push.
- [ ] T008 [передача] После коммита обновить обзор и карту; передать владельцу локальную миграцию и порядок ручной приёмки.

## Покрытие

| Критерий | Задачи |
| --- | --- |
| AC-1/2 | T001, T004, T006 |
| AC-3/4 | T001, T002, T004, T006 |
| AC-5/6 | T001, T005, T006 |
| AC-7 | T002, T003, T006 |

## Передача

Миграцию и проверку на изменяемой локальной БД запускает владелец после commit/push. Production-мigration/backup/recovery выполняет только владелец в отдельном выпуске.
