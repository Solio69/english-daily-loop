# Задачи: F04 — OpenRouter и AI-диагностика

**Вход:** [spec.md](spec.md), [plan.md](plan.md)

- [x] T001 [FR-001/002, AC-1] Сохранить OpenRouter-only request/fallback; пометить content-only retry и убрать provider/network retry в обеих pipeline.
- [x] T002 [FR-003, AC-2] Проверить чтение 90 с/25 с и ограничить серию карточек общими 30 с.
- [x] T003 [FR-004, AC-3] Сузить клиентские diagnostics до allowlist, убрать сырой provider message/words из логов и попыток.
- [x] T004 [AC-1–4] Подставные tests на успех, ошибки, timeout, content retry, бюджеты и отсутствие утечек; прогнать весь набор.
- [x] T005 [FR-005] После F03 поднять 1.1.4, сделать ровно один коммит F04 с полным пакетом и push.
