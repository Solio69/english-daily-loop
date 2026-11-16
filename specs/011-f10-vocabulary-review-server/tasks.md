# Задачи F10

**Вход:** spec.md, plan.md. **Статус:** реализовано; ручная приёмка владельца открыта.

- [x] T001 [FR-001–004; AC-1–4] Зафиксировать тестами snapshot пустой/непустой очереди, required/optional counts, четыре действия, переход learned, вход, SQL/RPC ошибки и повреждённый ответ.
- [x] T002 [FR-001–003; AC-1/4] Выделить snapshot сервис, проекцию карточки и RPC-адаптер без изменения календарного/очередного контракта.
- [x] T003 [FR-001–004; AC-2–4] Выделить review action сервис/RPC-адаптер с сохранением input/output/error mapping; SQL остаётся владельцем перехода.
- [x] T004 [FR-004; AC-2–4] Read-only SQL contract review интервалов, DB timestamp/date, locks и grants; gates, code/security review, verification и повторный analyze при правках документов.
- [x] T005 [FR-001–004] Patch-версия, адресный staged diff, один F10 commit и обычный push `origin HEAD:refactor/release-1.1`; обновить обзор/релизный документ.

## Покрытие и передача

AC-1 покрыт T001–T002, AC-2/3 — T001/T003/T004, AC-4 — T001–T004. Перед commit обязательны test:edge, test, test:e2e, typecheck, lint, format:check, lint:styles, build, `git diff --check`, review секретов и staged diff. Реальную DB-запись и конкуренцию подтверждает только владелец при необходимости.
