# План: F10 — повторение слов на сервере

**Спецификация:** spec.md. **Ветка:** refactor/release-1.1. **Remote:** origin.

## Решение

HTTP/auth остаётся в `index.ts`; отдельные сценарии собирают snapshot и выполняют review action. Предметный review-слой владеет типами/проекцией карточки и проверкой RPC JSON; Supabase-адаптер владеет вызовами server-only RPC. `get_or_create_vocabulary_review_state` и `review_vocabulary_word` сохраняют lock, расчёт даты mutation, переходы и marker. Дублирующий расчёт переходов на Edge не вводится.

## Проверка конституции

- C1–C3: актуальный код/RPC и согласованный обзор, отдельный Spec Kit F10.
- C4–C6: один F10 commit с patch-версией, тестами и документами после blocker-free analyze и gates.
- C7: Telegram auth, service role и SQL-grants сохраняются; агент не запускает DB mutation.
- C8: отдельные сервисы по двум сценариям, без широкого framework.

## Файлы и шаги

1. Зафиксировать Deno тестами empty/nonempty snapshot, required/optional counts, actions, input/errors и повреждённый RPC ответ; проверить SQL interval/date contract и отсутствие идемпотентности повторного ответа read-only.
2. Разделить `get-vocabulary-review-state/index.ts` и `review-vocabulary-word/index.ts` на HTTP, предметные сервисы и RPC-адаптеры; сохранить public response/error mapping.
3. Уточнить ответственность действующих `_shared/vocabulary-review.ts` и `vocabulary-review-state.ts`, убрать только реальное дублирование без изменения шкалы или очереди.
4. Проверить auth/owner scoping, дату 05:00 и server-only права; пройти gates и review, записать verification, повторить analyze при правках пакета.
5. Patch-версия, адресный staged diff, один `refactor: F10 ...` commit и обычный push назначенной ветки.

## Проверки и ограничения

Обязательны `pnpm test:edge`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm build`, `git diff --check`, review coding rules/секретов/staged diff. Mock и статический SQL review не доказывают реальную DB-конкурентность/запись marker. Владелец подтверждает её локальным сценарием, если потребуется.
