# Задачи F11

**Вход:** spec.md, plan.md. **Статус:** реализовано; ручная приёмка владельца открыта.

- [x] T001 [FR-001–005; AC-1–5] Компонентными/браузерными тестами зафиксировать вкладку, подготовку, review, empty/error, navigation, двойной ответ, stale-state и скрытый approval-flow.
- [x] T002 [FR-001/002; AC-1/5] Уточнить типы и runtime-проверку значимых полей `vocabularyService` без изменения корректных payload.
- [x] T003 [FR-001/004/005; AC-1/4/5] Отделить состояние `useVocabularyMaterials` и упростить `VocabularyTab`, сохранить оболочку/навигацию F13.
- [x] T004 [FR-001/003/005; AC-2–5] Отделить review-состояние `VocabularyScreen`, сохранить guard двойного ответа и stale-state, JSX/CSS/копирайт.
- [x] T005 [FR-001–005; AC-1–5] Сквозной тест F08–F11, визуальный/code/security review, gates и verification; повторный analyze при правках документов.
- [x] T006 [FR-001–005] Patch-версия, адресный staged diff, один F11 commit и обычный push `origin HEAD:refactor/release-1.1`; обновить обзор/релизный документ.

## Покрытие и передача

AC-1 покрыт T001–T003/T005, AC-2/3 — T001/T004/T005, AC-4/5 — T001–T005. Перед commit обязательны test:edge, test, test:e2e, typecheck, lint, format:check, lint:styles, build, `git diff --check`, review секретов и staged diff. Владелец выполняет ручную проверку dev-бота и мобильных тем.
