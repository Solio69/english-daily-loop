# Проверка F06 — состояние чтения на сервере

Дата: 2026-10-20. Ветка: refactor/release-1.1. Версия пакета: 1.1.6.

## Реализация

Четыре существующих Edge Function разделены на HTTP-обработчики, сценарии и Supabase/RPC-адаптеры. Получение состояния сохраняет единственный активный текст, дневные попытки и отметку завершения по московской учебной дате, а также индексы сохранённых и pending-слов. Сохранение позиции проверяет ID текущего текста и границы абзацев; null остаётся верхом текста. Завершение использует прежнюю атомарную RPC и считает производные метрики по дате, возвращённой БД. История сохраняет пользовательский фильтр, порядок и курсор. Публичные контракты, схема БД и клиент не менялись.

## Проверки

| Проверка | Результат |
| --- | --- |
| node scripts/quality/run-deno.mjs как эквивалент pnpm test:edge | Passed: Deno check 67 файлов Edge Functions, lint и 18 shared тестов |
| Новые Deno-тесты сценариев и адаптера | Passed: 9 сценариев state, words, position, completion, history |
| tsx --test tests/*.test.ts с TEMP/TMP=tools/test-temp | Passed: 220 тестов |
| vitest run | Passed: 2 теста |
| tsc --noEmit | Passed |
| node scripts/quality/check-code.mjs lint | Passed |
| node scripts/quality/check-code.mjs format | Passed |
| node scripts/quality/check-code.mjs styles | Passed |
| playwright test вне песочницы | Passed: 2 e2e теста |
| vite build | Passed |
| git diff --check и адресное Prettier | Passed |

Использованы установленные локальные бинарники без скачивания пакетов. Миграции и DB-команды изменения данных агентом не запускались. Ручная приёмка в локальном dev-боте остаётся за владельцем.

## Review

Сверены действующие коды ошибок, проверки Telegram initData до обращения к БД, фильтрация по user ID, существующая RPC завершения и связь производных метрик с DB completedDate. Архитектурные тесты обновлены под расположение владельцев логики. Spec, plan и tasks согласованы с реализацией; изменение поведения не выявлено.
