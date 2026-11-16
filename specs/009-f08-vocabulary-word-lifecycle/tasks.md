# Задачи: F08 — жизненный цикл слова на сервере

**Вход:** spec.md, plan.md. **Статус:** готово к read-only analyze.

## Шаги

- [x] T001 [FR-001–004; AC-1–6] Зафиксировать текущие save/delete контракты в Deno тестах: вход, active text, слово, лимит, повторы, подготовленная карточка, RPC ошибки и request ID.
- [x] T002 [FR-002–004; AC-1/2/5/6] Выделить save contract/service/repository, сохранить порядок проверки слова, уровня, лимита и save RPC.
- [x] T003 [FR-002–004; AC-3–6] Выделить delete contract/service/repository, сохранить более строгую валидацию и сопоставление RPC кодов с HTTP.
- [x] T004 [FR-003/005; AC-1–6] Проверить SQL lock/ownership contract без запуска БД, F07 word action response, F09 pending target и отсутствие прямой клиентской записи.
- [x] T005 [FR-001–005; AC-1–6] Выполнить все gates из plan.md, провести coding/security review, записать факты в verification.md и повторить analyze при правках документов.
- [x] T006 [FR-001–005] Повысить patch-версию; проверить ветку и адресный staged diff; сделать один `refactor: F08 ...` commit и обычный push `origin HEAD:refactor/release-1.1`. Обновить обзор и релизный документ.

## Покрытие

| Требование / критерий | Шаги и проверка |
| --- | --- |
| FR-001/002; AC-1/5/6 | T001–T003, Deno endpoint/service tests |
| FR-003/004; AC-2/3/4 | T001–T004, mock RPC и read-only SQL contract |
| FR-005; AC-6 | T004–T005, security review и все gates |

## Перед коммитом и передачей

Обязательны test:edge, test, test:e2e, typecheck, lint, format:check, lint:styles, build, `git diff --check`, review coding rules, секретов, FR/AC и staged diff. Неуспешный gate блокирует commit. Реальную конкурентность нельзя объявлять проверенной без owner-run DB теста.

## Действия пользователя

После передачи F08 владелец проверяет сценарий save/delete в локальном dev-боте. PR, merge и выпуск остаются за владельцем. Если потребуется локальный DB тест с изменением данных, агент готовит отдельную команду и ожидаемый результат; владелец исполняет её сам.
