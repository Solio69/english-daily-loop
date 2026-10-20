# Анализ F09

**Дата:** 2026-10-20. **Результат:** блокирующих замечаний нет; пакет согласован с реализацией.

Read-only проверены spec/plan/tasks/checklists, конституция, текущие `prepare-vocabulary-cards`, AI pipeline, state/words endpoint и действующие RPC. AC-1–5 покрыты FR-001–005 и T001–T004. Зафиксированы batch=5, HTTP 200 при полном AI failure, prompt `vocabulary-card-v1` с UUID, per-card атомарный RPC, секции `needsApproval`/`ready` с limit 50. Область F10/F11 и SQL не затронута. Реальный provider/DB и конкурентность остаются отдельной ручной проверкой владельца.

Повторный read-only проход после реализации: HTTP/auth остаётся в трёх `index.ts`, batch-сервис использует предметный репозиторий, prompt/validation/transport разделены, поля и счётчики проекций согласованы со spec. Новых блокирующих замечаний нет.
