# Проверка F09 — подготовка AI-карточек

Дата: 2026-10-20. Ветка: `refactor/release-1.1`. Версия пакета: `1.1.9`.

## Реализация

`prepare-vocabulary-cards/index.ts` проверяет HTTP/env/Telegram и передаёт запрос batch-сервису. Сервис сохраняет порядок: уровень и pending-слова → дневной лимит/claim → AI batch → поочерёдное сохранение карточек → счётчики и финализация attempt. Репозиторий изолирует запросы Supabase, shared attempt helpers и атомарный `persist_generated_vocabulary_card`. Prompt, валидация AI и OpenRouter transport разделены; prompt version `vocabulary-card-v1`, внутренние UUID, model chain, timeout/retry policy и HTTP 200 при полном AI failure сохранены. Серверные state/words endpoint получили отдельные read projections с owner scoping, прежними полями, порядком и пределом 50 элементов на секцию. Повреждённые строки или RPC success-ответы дают безопасную ошибку/неуспешное сохранение.

## Проверки

| Проверка | Результат |
| --- | --- |
| Deno check/lint/shared tests через `scripts/quality/run-deno.mjs` | Passed: 39 тестов, включая 10 новых F09 |
| `tsx --test tests/*.test.ts`, TEMP/TMP внутри проекта | Passed: 225 тестов |
| `vitest run` | Passed: 9 тестов |
| `playwright test` с доступом к локальному loopback | Passed: 5 тестов |
| `tsc --noEmit` | Passed |
| `check-code.mjs lint` | Passed |
| `check-code.mjs format` | Passed |
| `check-code.mjs styles` | Passed |
| `vite build` | Passed; прежнее предупреждение о размере общего JS chunk |
| `git diff --check` | Passed перед staging |

Использованы уже установленные локальные бинарники, так как `pnpm` shim Volta здесь недоступен. Первый общий legacy-прогон обнаружил статическую проверку, привязанную к двойным кавычкам в прежнем файле; тест обновлён под фактический RPC-вызов и повторный прогон прошёл. Реальные AI-вызовы, DB-mutation, миграции и dev-бот агентом не запускались. Ручная приёмка владельца ожидается.

## Review

Сверены batch=5, порядок claim/metadata/persistence, частичный и полный AI failure, cancelled target, merge/reactivation counters, безопасная диагностика, отсутствие ключа в клиенте/логах, Telegram auth, owner scoping и server-only RPC/grants. Моковые и статические тесты не доказывают реальную конкурентность БД. Spec, plan, tasks и code diff согласованы; блокирующих замечаний нет.
