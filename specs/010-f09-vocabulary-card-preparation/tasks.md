# Задачи F09

**Вход:** spec.md, plan.md. **Статус:** реализовано; ручная приёмка владельца ожидается.

- [x] T001 [FR-001–004; AC-1–3/5] Тестами зафиксировать batch=5, claim/лимит, пустую очередь, AI полный/частичный отказ, unknown/duplicate ID, merge/deletion/reactivation, диагностику и public errors.
- [x] T002 [FR-002–004; AC-1–3] Выделить batch-сервис, AI transport/prompt/validation и Supabase/RPC-адаптеры; сохранить порядок и provider policy.
- [x] T003 [FR-001/005; AC-4/5] Отделить read projections state/words, покрыть owner scoping, поля, счётчики, сортировку и limit 50.
- [x] T004 [FR-001–005; AC-1–5] Read-only SQL/client contract review; gates и code/security review; результаты в verification.md, повторить analyze при правках документов.
- [x] T005 [FR-001–005] Patch-версия, адресный staged diff, один F09 commit и обычный push `origin HEAD:refactor/release-1.1`; обновить обзор/релизный документ.

## Покрытие и передача

AC-1–3 покрыты T001–T002, AC-4 — T003, AC-5 — T001–T004. Перед commit обязательны test:edge, test, test:e2e, typecheck, lint, format:check, lint:styles, build, `git diff --check`, review секретов и staged diff. Реальный AI/DB сценарий остаётся ручной приёмкой владельца в dev-боте.
