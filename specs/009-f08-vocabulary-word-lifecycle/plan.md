# План: F08 — жизненный цикл слова на сервере

**Спецификация:** spec.md
**Основной обзор:** D:/anastasiaStorage/Проекты/English daily loop/_work/F08 — Жизненный цикл слова на сервере.md
**Ветка владельца:** refactor/release-1.1
**Remote:** origin

## Решение и основания

Оставить `index.ts` каждого endpoint владельцем HTTP/CORS/auth/env/request ID и сборки зависимостей. Вынести разбор входа и error mapping в локальный contract модуль, предметные проверки и порядок вызовов — в service, Supabase-запросы и RPC — в repository. Не создавать общий парсер для различающихся `readingTextId`/`wordIndex`. Общим остаётся существующий server/app слой; новый shared helper допустим только для полностью эквивалентного правила.

RPC остаются единственным владельцем решающих проверок при гонке: пользовательский advisory lock, проверка active text, лимит/статус и источники в той же транзакции. Edge проверяет данные заранее для понятной ошибки, но не заменяет RPC-проверку. Репозиторий проверяет форму untrusted RPC JSON и возвращает прежние ошибки либо безопасную 500 при повреждённом ответе.

## Контекст

`save-vocabulary-word/index.ts` содержит входную валидацию, проверку слова в активном тексте, запрос уровня/лимита и RPC. `delete-pending-vocabulary-word/index.ts` содержит более строгую валидацию входа, загрузку active text и отдельную обработку RPC-кодов. SQL-контракты находятся в существующих миграциях `20260511150000_add_pending_vocabulary_word_save_rpc.sql`, `20260813120000_add_pending_vocabulary_word_deletion.sql` и связанных поздних определениях. Соседние F09/F11 используют результаты этих операций; публичный API сохраняется.

## Проверка конституции

- C1–C2: факты сверены с действующими endpoint/RPC и согласованным обзором F08–F11; новых продуктовых правил нет.
- C3: отдельный пакет `specs/009-f08-vocabulary-word-lifecycle`, spec/plan/tasks раздельны.
- C4: один F08 commit с техническим пакетом, кодом, проверками и patch-версией; push только в назначенную ветку после сверки.
- C5–C6: поведенческие тесты до переноса, обязательные quality gates, read-only analyze до кода и review после реализации.
- C7: Telegram validation/server-only RPC, секреты и SQL-права сохраняются; агент не выполняет DB-mutation команды.
- C8: предметные модули соразмерны двум endpoint; архивные инструкции не применяются.

## Дополнительные документы

Новая модель данных не нужна: таблицы и RPC остаются прежними. Контракт фиксируется в spec и тестах; отдельный contracts файл не требуется. Readiness/acceptance checklist и analysis/verification создаются в этом пакете.

## План файлов и шагов

1. Добавить Deno tests для входной валидации, active text, совпадения слова, лимита, повторов, prepared/delete conflict и безопасных RPC ошибок; обновить только необходимые статические SQL tests.
2. В `supabase/functions/save-vocabulary-word/` выделить contract/service/repository из index, сохранив порядок вызовов и форму ответа.
3. В `supabase/functions/delete-pending-vocabulary-word/` выделить contract/service/repository, сохранив отдельные правила входа, response request ID и error mapping.
4. Проверить соседние F07/F09 контракты, секреты, owner-scoping и отсутствие прямой клиентской DB-записи; Deno check/lint.
5. Выполнить обязательные gates и code review, записать результаты в verification.md, закрыть tasks и повторить analyze при изменении технического пакета. Повысить patch-версию, адресно staged diff, один F08 commit и обычный push.

## Проверки

Перед коммитом: `pnpm test:edge`, `pnpm test`, `pnpm test:e2e`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm build` либо эквивалентные уже установленные локальные бинарники при неисправном pnpm shim. Проверить `git diff --check`, изменение только согласованных файлов, правила `.agents/rules/CODING_RULES.md`, отсутствие секретов и соответствие FR/AC. DB/RPC сценарии, меняющие данные, агент не запускает; их необходимость и точные команды передаёт владельцу.
