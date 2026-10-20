# План: F12 — профиль, настройки и доступ

**Спецификация:** [spec.md](spec.md)
**Основной обзор:** D:\anastasiaStorage\Проекты\English daily loop\_work\F12 — Профиль, настройки и доступ.md
**Ветка владельца:** refactor/release-1.1
**Remote:** origin, refactor/release-1.1

## Решение и основания

Сервер: auth-telegram и save-user-settings остаются HTTP/auth/error-обработчиками. Профильный repository отвечает за поиск/создание пользователя, чтение и запись настроек. Отдельный response/mapper собирает действующие ответы из проверенных данных. Существующий access.ts остаётся единственным серверным расчётом роли, подписки и лимитов. Валидация тела запроса выполняется до записи. Новые транзакционные правила и SQL не добавляются. activate-subscription сохраняет текущий серверный флаг и RPC, его скрытый контракт проверяется регрессией.

Клиент: userService отвечает за Telegram/API и маппинг ответа. useAppUserProfile владеет начальной попыткой, статусом ошибки, повтором и обновлением на смене учебной даты. App.tsx допускает основную оболочку только после успешного профиля. Отдельное состояние ошибки использует существующие LoadingState, InlineStatusCard и Button. При сохранении настроек серверные user/settings/subscription применяются к текущему профилю; homeProgress берётся из ответа сервера, если за время запроса клиентский прогресс не менялся, иначе остаётся новое локальное состояние. Streak и счётчик истории сохраняются из текущего профиля.

## Контекст

Стек: React 19, TypeScript, Vite, Supabase Edge Functions/Deno, существующие Vitest/Playwright/Deno. Новые пакеты не нужны. Затронуты src/App.tsx, src/hooks/useAppUserProfile.ts, src/hooks/useAppUserActions.ts, src/services/userService.ts, типы профиля, небольшое состояние ошибки, supabase/functions/auth-telegram/index.ts, supabase/functions/save-user-settings/index.ts и два отдельных общих модуля repository/response. src/screens/SettingsScreen.tsx меняется только при необходимости ясной границы формы/состояния. supabase/functions/_shared/access.ts и activate-subscription — смежные контракты для тестов. Postgres-схема, RLS, grants и RPC сохраняются. Исходный auth response содержит user/settings/subscription/homeProgress/streakDays/completedReadingTextCount; settings response содержит user/settings/subscription/homeProgress.

## Проверка конституции

- C1: актуальные функции, UI и тесты проверены; варианты обсуждены с владельцем.
- C2: три обзора утверждены владельцем; F12 имеет собственное согласованное решение.
- C3: явная папка specs/013-f12-profile-access, скриптам передаётся абсолютный ExpectedFeatureDirectory.
- C4: только назначенная ветка; один проверенный commit F12 с patch-версией 1.1.12, затем push origin/refactor/release-1.1; PR и выпуск владельца.
- C5: typecheck, lint, format, styles, test, edge, e2e, build, ревью правил и verification.md. Read-only release:check фиксируется отдельно; финальная синхронизация артефактов входит в F17.
- C6: analyze только читает, результат записывается отдельным действием; блокеры закрываются до кода.
- C7: initData проверяется сервером, секреты не выводятся, БД агентом не меняется, установок/миграций нет.
- C8: scope ограничен профилем/доступом и согласованной ошибкой входа; F13 отвечает за общую оболочку, F14 — за dev tools.

## Дополнительные документы

Отдельная модель данных не нужна: схема не меняется. Контракт действующих ответов и ошибок описан в spec.md, дополнительных контрактных файлов нет. Действия владельца и проверка dev-бота указаны в обзоре и verification.md.

## План файлов и шагов

1. Добавить серверные и клиентские тесты, фиксирующие первый/повторный вход, настройки, роли, отказ и повтор. Использовать моки DB/API, не обращаться к реальной БД.
2. Выделить раздельные server repository и response/mapper в supabase/functions/_shared; оставить Edge Functions тонкими. Сохранить структуру ответов и ошибки. Проверить серверные тесты.
3. Упростить клиентский userService и обновление профиля, добавить явный статус ошибки и повтор, сохранить московскую смену даты. Проверить компонентные и браузерные сценарии.
4. Проверить скрытую подписку и соседние сценарии, пройти quality gates, провести код-ревью и повторный анализ Spec Kit; записать реальные результаты.
5. Повысить patch-версию до 1.1.12, проверить staged diff и отсутствие чужих файлов/секретов, выполнить один commit с номером F12 и обычный push в проверенный remote/ветку. После push обновить человеческий обзор и групповой статус в Obsidian.

## Проверки

Обязательные перед commit: pnpm typecheck; pnpm lint; pnpm format:check; pnpm lint:styles; pnpm test; pnpm test:edge; pnpm test:e2e для bootstrap и соседних экранов; pnpm build. Read-only pnpm release:check выполняется и фиксируется, но его несоответствие будущей версии 1.1.x опубликованным release metadata не блокирует предметный коммит F12: приведение артефактов к итоговой версии относится к F17. Проверить код по .agents/rules/CODING_RULES.md, TypeScript/Edge boundary, безопасность логов, соответствие spec/tasks и полный staged diff. В verification.md записать команды, фактические результаты и ручные проверки как NotRun до сообщения владельца. Браузерные тесты на моках не изменяют БД. Ни один тест не должен отправлять реальные запросы в production.
