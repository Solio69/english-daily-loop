# План: F15 — Telegram-бот и конфигурация

**Спецификация:** [spec.md](spec.md)
**Основной обзор:** `D:\anastasiaStorage\Проекты\English daily loop\_work\F15 — Telegram-бот и конфигурация.md`
**Ветка / remote:** `refactor/release-1.1` / `origin`

## Архитектура

`bot-profile.mjs` владеет профилем, URL/secret validation и построением последовательности операций. `bot-api.mjs` владеет Telegram HTTP-вызовом, timeout, безопасными ошибками и классификацией отказа webhook. `bot-config.mjs` остаётся публичной точкой импорта для dev-stack, delete helper и тестов: оркестрирует `getMe`, сравнение username, пропуск совпавших полей, применение операций и получение безопасного webhook status; реэкспортирует прежние публичные функции и константы. Серверный Deno webhook и PowerShell helper не меняют runtime-структуру. Совпадение профиля подтверждается тестом по двум независимым источникам и JSON; PS1 по-прежнему читает JSON.

## Контекст и зависимости

Меняются только локальные JS-модули и целевые тесты. Существующие `scripts/dev-stack.mjs` и `scripts/telegram/delete-dev-webhook.mjs` продолжают импортировать `bot-config.mjs`. Новых пакетов, миграций, DB команд, вызовов настоящего Telegram API и настроек production нет. Пакетная версия коммита — `1.1.15`. Опубликованные release metadata остаются задачей F17.

## Проверка конституции C1–C8

C1/C2: выбранное решение и границы утверждены владельцем. C3/C6: каталог `specs/016-f15-telegram-bot`, явный `ExpectedFeatureDirectory`, read-only analyze и отдельная запись отчёта. C4: один проверенный commit F15 и обычный push в `origin/refactor/release-1.1`. C5: тесты контрактов, все обязательные gates, ревью diff. C7: реальные секреты и production действия исключены; тесты используют синтетический token/fetch. C8: тексты и продуктовый поток не меняются.

## Шаги

1. Зафиксировать текущий public API и негативные сценарии configure/delete, API error и profile parity тестами.
2. Выделить профиль/построение операций и API-клиент; сделать `bot-config.mjs` небольшим оркестратором с совместимыми экспортами.
3. Проверить, что PS1 читает JSON, dev-stack и delete helper сохранили контракт; усилить тесты webhook при наличии конкретного пробела.
4. Запустить typecheck, lint, format, styles, legacy/Vitest, Deno и build; ревью код/тесты/секреты/Spec Kit, повторный read-only analyze, записать `verification.md`.
5. Поднять patch-версию, проверить staged diff, ветку, remote и outgoing; сделать один commit F15 и push. После коммита обновить обзор и карту с фактическим результатом.

## Проверки и передача

Обязательные gates: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm lint:styles`, `pnpm test`, `pnpm test:edge`, `pnpm build`. При неисправном pnpm shim использовать уже установленный bundled Node и локальные бинарники без установки. Ручной dev-бот: `/start`, `/help`, неизвестная команда, кнопка Mini App. Production helper запускает только владелец при выпуске. `release:check` фиксирует известное несоответствие рабочей версии и опубликованных metadata до F17.
