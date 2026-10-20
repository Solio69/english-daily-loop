# План: F09 — подготовка AI-карточек

**Спецификация:** spec.md. **Ветка:** refactor/release-1.1. **Remote:** origin.

## Решение

`index.ts` остаётся HTTP/auth/env границей и собирает зависимости. Предметный batch-сервис владеет порядком загрузки pending, лимита/claim, AI-вызова, per-card persistence, счётчиков и финализации attempt. Отдельные адаптеры владеют Supabase/RPC и OpenRouter; prompt/version/валидация AI отделены от HTTP транспорта. `get-vocabulary-state` и `get-vocabulary-words` получают отдельные серверные проекции с прежними полями. Общие helpers выделяются только для совпадающей семантики. Существующий атомарный `persist_generated_vocabulary_card` остаётся владельцем race-sensitive выбора.

## Проверка конституции

- C1–C3: scope следует согласованному обзору и актуальным endpoint, отдельный Spec Kit F09.
- C4–C6: один commit F09 с patch-версией, тестами и техническими документами после read-only analyze и обязательных gates.
- C7: Telegram/server-only ключи и безопасная диагностика сохраняются; агент не запускает изменение БД.
- C8: предметный batch-сервис и проекции соразмерны фиче, архивные правила не применяются.

## Файлы и шаги

1. Зафиксировать Deno тестами пустую очередь, дневной claim, batch=5, provider failure, частичный ответ, unknown/duplicate ID, merge, deleted target, metadata и безопасные ошибки.
2. Разделить `prepare-vocabulary-cards/index.ts`, `ai-pipeline.ts`, `card-persistence.ts` и shared attempt helper по действующим обязанностям без смены prompt version, UUID и provider policy.
3. Выделить проекции `get-vocabulary-state`/`get-vocabulary-words`, проверить owner scoping, сортировку/limit 50 и форму ответа для F11.
4. Сверить SQL RPC contract и клиентские ожидания read-only; провести code/security review, gates, verification и повторный analyze при существенных правках.
5. Patch-версия, адресный staged diff, один `refactor: F09 ...` commit и обычный push назначенной ветки.

## Проверки и ограничения

Обязательны `pnpm test:edge`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm build`, `git diff --check`, review coding rules/секретов/staged diff. Если pnpm shim неисправен, допустимы эквивалентные установленные локальные бинарники с явной записью в verification. Реальные AI/DB вызовы агент не делает; mock/static tests не подтверждают конкурентность БД.
