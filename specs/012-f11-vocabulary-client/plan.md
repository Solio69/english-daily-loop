# План: F11 — клиентский словарь и повторение

**Спецификация:** spec.md. **Ветка:** refactor/release-1.1. **Remote:** origin.

## Решение

`vocabularyService` остаётся API-границей и проверяет значимые поля ответа. `useVocabularyMaterials` управляет загрузкой/подготовкой словарной вкладки; отдельное состояние экрана `VocabularyScreen` управляет review и блокировкой повторного ответа. Компоненты отвечают за отображение. Общие предметные helpers выделяются только при совпадающем правиле. `MaterialsScreen` используется как существующая оболочка; его навигация и история остаются F13.

## Проверка конституции

- C1–C3: scope и критерии из согласованного обзора, отдельный Spec Kit F11.
- C4–C6: один F11 commit с patch-версией, тестами/документами после analyze, обязательных gates и review.
- C7: initData передаётся действующему server endpoint; секреты/прямая DB-запись не вводятся.
- C8: локальные React hooks/service и композиция без нового state framework.

## Файлы и шаги

1. Зафиксировать компонентными/браузерными тестами список, подготовку, review, пустой план, API ошибки, возврат между экранами и stale-state после сохранённого ответа.
2. Разделить типы/API validation и состояние двух сценариев; сохранить корректные server payload и сообщения.
3. Упростить `VocabularyScreen`, `VocabularyTab` и связанные компоненты, не меняя JSX/CSS/копирайт, флаг approval и маршруты.
4. Проверить сквозной путь F08–F11 с подставными данными, светлую/тёмную тему и мобильный layout; выполнить gates/review, verification и повторный analyze при правках пакета.
5. Patch-версия, адресный staged diff, один `refactor: F11 ...` commit и обычный push назначенной ветки.

## Проверки и ограничения

Обязательны `pnpm test:edge`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm build`, `git diff --check`, review coding rules/секретов/staged diff. Визуальную ручную приёмку и dev-бот выполняет владелец; автоматические тесты не подтверждают production Telegram WebView.
