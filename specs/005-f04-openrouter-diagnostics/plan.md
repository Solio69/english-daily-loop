# План: F04 — OpenRouter и AI-диагностика

**Спецификация:** [spec.md](spec.md)

**Ветка/remote:** `refactor/release-1.1` / `origin`

## Решение

`requestOpenRouter` остаётся единственным transport. Он отмечает только HTTP 2xx с пустым content как `retryableContent`, остальные provider/network/timeout ошибки завершаются сразу. Сырой provider message никогда не переносится в текст ошибки; status и ограниченный код остаются в server metadata. Два предметных pipeline отвечают за валидность содержимого и конечное исключение модели из списка. Reading сохраняет общий дедлайн 90 с и максимум 25 с на запрос; vocabulary получает общий дедлайн 30 с и максимум 30 с на запрос, то есть общий максимум ожидания не растёт. Клиентская диагностика формируется строгими полями в `_shared/ai-diagnostics.ts`; произвольные `error.message`, `details` и `problemWords` исключаются. Серверные логи тоже не содержат raw provider body/message.

## Файлы и порядок

1. `_shared/openrouter.ts`: безопасная нормализация errors, признак content-only retry, проверка timeout.
2. `generate-reading-text/ai-pipeline.ts`, `prepare-vocabulary-cards/ai-pipeline.ts`: убрать retry provider/network ошибок, ограничить content retry модельной цепочкой и общим временем.
3. `_shared/ai-diagnostics.ts` и два index.ts: строгая диагностическая схема, исключение arbitrary details/words/error text, сохранить request ID и понятный user message. При записи metadata в БД передавать лишь безопасные сообщения.
4. `tests/openrouter.test.ts`, отдельные тесты безопасной диагностики и vocabulary: success/429/5xx/timeout/empty/invalid/budget/negative assertions.
5. Полные проверки и review, затем после F03 версия 1.1.4 и один коммит F04 со спеками/кодом/тестами.

## Конституция и границы

C1: текущие transport/pipelines/diagnostics прочитаны; C2: обзор и ветка согласованы; C3: явная папка specs; C4: один коммит после F03; C5: проверки; C6: отдельный analyze; C7: без DB-команд/секретов; C8: один провайдер, без новых пакетов/промптов/миграций.

## Проверки

`pnpm test:legacy` (в том числе OpenRouter/diagnostics), `pnpm test:edge`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm build`, review staged diff и отсутствия секретов. Данные БД не меняются агентом. CI — после push.
