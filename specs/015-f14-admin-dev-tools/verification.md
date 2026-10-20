# Проверка F14 — админские dev tools

**Дата:** 2026-10-20. **Ветка:** `refactor/release-1.1`. **Версия:** `1.1.14`.

## Автоматические проверки

| Проверка | Результат |
| --- | --- |
| TypeScript `tsc --noEmit` | Passed |
| `lint`, `format:check`, `lint:styles` | Passed |
| Deno check/lint/test Edge Functions | Passed, 60 тестов |
| Legacy `tsx --test tests/*.test.ts` | Passed, 234 теста; temp-file tests запущены вне sandbox после EPERM |
| Vitest | Passed, 25 тестов |
| Playwright, полный набор | Passed, 16 сценариев; локальный браузер с моками, вне sandbox после зависания тестового сервера |
| Vite build | Passed; существующее предупреждение о главном chunk ~528 kB |
| Deno fmt для файлов F14, `git diff --check` | Passed |
| `release:check` read-only | Failed ожидаемо: рабочая версия 1.1.14, опубликованные metadata 1.0.0 и отсутствует heading 1.1.14 в CHANGELOG; синхронизация входит в F17 |

## Проверка требований

AC-1: флаг проверяется до env/body/service client в endpoint; Deno guard test прошёл. AC-2: role lookup происходит до действия, tester/user получают отказ без mutation calls, admin выполняет маршрут. AC-3: parser отклоняет неверные action/step; восемь маршрутов проверены. AC-4: компонентный тест проверяет кнопки и блокировку; браузерные тесты проверяют видимость, успех с обновлением профиля и отказ с toast без обновления. AC-5: сырой DB message и user ID не попадают в логи обработчика; HTTP error envelope использует безопасные сообщения, ревью server logs проведено.

## Ревью и ограничения

Сохранены существующие таблицы, фильтры, порядок удаления двух записей чтения, RPC и московская учебная дата. Новых пакетов, миграций, изменений RLS/grants и вызовов, меняющих реальные данные БД, нет. Ручная проверка панели в dev-боте: **NotRun**, выполняет владелец после push. Production и релиз не затронуты.
