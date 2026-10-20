# План: F05 — генерация текста на сервере

**Спецификация:** spec.md
**Основной обзор:** D:\anastasiaStorage\Проекты\English daily loop\_work\F05 — Генерация текста на сервере.md
**Ветка владельца:** refactor/release-1.1
**Remote:** origin

## Решение и основания

Выполнить согласованный вариант B как предметный серверный модуль без общей платформы для всех Edge Functions. Точка HTTP оставляет CORS, POST, Telegram initData, env, request ID и преобразование результата в существующий ответ. Оркестратор генерации работает с узкими портами: часы/учебная дата, AI-генератор и операции хранилища. Supabase-адаптер реализует чтение настроек и доступа, claim, metadata, ожидание дубля, finish и mark-failed. Предметный AI-модуль сохраняет prompt и правила проверки, OpenRouter остаётся внешним транспортным адаптером F04.

Граница тестирования — сценарий с подставными портами и отдельные контракты Supabase/RPC. Не менять сигнатуры RPC и публичные API. Обработчик и адаптер проверяют untrusted DB/RPC JSON на границе без обходного any/cast. Избегать абстракции с одним методом на каждую строку Supabase, группировать методы по предметной операции.

## Контекст

Сейчас generate-reading-text/index.ts содержит HTTP, доступ, лимит, claim/duplicate, AI и persistence; ai-pipeline.ts содержит prompt, parse/validation и вызов transport. F04 уже определяет конечный content-only retry и безопасную диагностику. Текущие RPC claim_reading_generation_request и finish_reading_generation_request обеспечивают уникальность request ID и атомарное завершение. Сервис клиента сохраняет request ID после неясного сетевого результата.

Файлы: supabase/functions/generate-reading-text/index.ts и ai-pipeline.ts, создаваемые предметные modules рядом с функцией либо в _shared/reading, тестовые mocks и Deno tests. Существующие OpenRouter тесты не заменяются текстовыми проверками.

## Проверка конституции

- C1: текущее поведение подтверждено обработчиком, AI pipeline, RPC и клиентским retry.
- C2: основной обзор F05–F07 согласован владельцем, ветка назначена.
- C3: явная директория specs/006-f05-reading-generation; spec/plan/tasks раздельны.
- C4: один коммит F05 с номером, техническим пакетом, кодом, проверками и patch-версией; push только origin/refactor/release-1.1 после сверки.
- C5: все проверки ниже и review изменённых файлов обязательны.
- C6: отдельный read-only analyze и отчёт после него до кода.
- C7: server-only ключи, Telegram validation, grants и данные не меняются; DB-команды агент не выполняет.
- C8: предметные интерфейсы без универсального фреймворка и без истории изменений в spec.

## Дополнительные документы

contracts/reading-api.md фиксирует сохраняемый внешний контракт F05–F07 и границы F08/F13. Отдельная модель данных не нужна: схема остаётся действующей.

## План файлов и шагов

1. Добавить поведенческие тесты на success, limit, duplicate/in-progress/failed/superseded, invalid content, provider/DB failure и безопасность диагностики. Фикстуры отдельно от ожиданий; существующий ответ проверять независимо от реализации.
2. Ввести предметные типы и порты чтения/AI/времени, узкий Supabase-адаптер и оркестратор. Разделить prompt/validation и AI routing при сохранении экспорта generateReadingTextWithOpenRouter для существующих тестов.
3. Свести index.ts к HTTP/auth/env/composition/error response. Сохранить порядок операций и форму ошибок. Проверить Deno typecheck каждой затронутой функции.
4. Проверить сохранность F04, клиентского retry и соседнего F06 API; ревью секретов, конкурентного поведения и отсутствия прямого клиентского DB-доступа.
5. Выполнить обязательные проверки, записать verification.md и закрыть tasks. Поднять patch-версию на единицу только после готовности F05. Проверить staged diff, создать один commit refactor: F05 ... и выполнить обычный push.

## Проверки

Перед коммитом: pnpm test:edge, pnpm typecheck, pnpm lint, pnpm format:check, pnpm lint:styles, pnpm test, pnpm test:e2e, pnpm build; Deno check/lint затронутых модулей при необходимости, review coding rules, spec↔tasks, staged diff и поиск секретов. Неуспешный обязательный gate блокирует коммит. Миграции не планируются. Если для контракта потребуется локальный DB/RLS тест с изменением данных, команду выполняет только владелец; результат указывается отдельно.
