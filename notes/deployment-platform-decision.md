# Выбор платформы для production

## Решение

Для первого production-релиза используется связка:

```text
Frontend: Vercel
Backend и данные: Supabase Cloud
AI-провайдер: OpenRouter
Точка входа Telegram: URL кнопки меню BotFather -> production URL Vercel
```

Это целевая схема для MVP. VPS/self-hosting остаётся возможным будущим вариантом, но не используется для первого релиза.

## Почему выбран этот вариант

Приложение уже построено вокруг Supabase:

- схема Postgres хранится в `supabase/migrations`;
- серверная бизнес-логика находится в Supabase Edge Functions;
- защищённые операции выполняются через `SUPABASE_SERVICE_ROLE_KEY`;
- frontend работает через сервисный слой и не пишет напрямую в защищённые таблицы;
- локальный Telegram-режим воспроизводит production-like схему: frontend build, Supabase API URL и Edge Functions.

Vercel подходит для frontend-части, потому что Vite build представляет собой статическое приложение: `index.html`, JS, CSS, шрифты и другие assets. Telegram Mini App открывает этот HTTPS URL внутри WebView.

Supabase Cloud подходит для backend-части, потому что сохраняет текущую модель Postgres + Edge Functions без отдельного backend на Express или Nest.

## Архитектура приложения

```text
Telegram Mini App
  -> открывает HTTPS URL Vercel внутри Telegram WebView
  -> загружает frontend на Vite/React
  -> frontend читает Telegram.WebApp.initData
  -> frontend вызывает Supabase Edge Functions
  -> Edge Functions проверяют initData и используют service role для серверной работы с БД
  -> Postgres хранит пользователей, настройки, чтение, словарь, повторение и отчёты об ошибках
```

## Распределение ответственности между платформами

### Vercel

Vercel хранит и раздаёт только frontend assets.

Vercel env содержит только публичные frontend-переменные:

- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`;
- `VITE_FEEDBACK_TELEGRAM_USERNAME`.

Серверные секреты запрещено помещать в переменные Vercel с префиксом `VITE_*`.

### Supabase Cloud

В Supabase Cloud находятся:

- база данных Postgres;
- RLS, grants и server-only RPC;
- Edge Functions;
- secrets для Edge Functions;
- platform logs;
- database runtime, который используется только как источник чтения для локальных logical backups.

Supabase Edge Function secrets содержат server-only значения:

- `OPENROUTER_API_KEY`;
- `TELEGRAM_BOT_TOKEN`;
- `TELEGRAM_BOT_WEBHOOK_SECRET`;
- `DEV_TOOLS_ENABLED`;
- `SUBSCRIPTION_FLOW_ENABLED`;
- необязательные переменные цепочки моделей OpenRouter.

## Порядок production-деплоя

1. Создать или выбрать проект Supabase Cloud.
2. Применить миграции БД к Supabase Cloud.
3. Настроить secrets для Supabase Edge Functions.
4. Развернуть Supabase Edge Functions.
5. Создать проект Vercel из репозитория.
6. Настроить frontend env в Vercel.
7. Развернуть frontend в Vercel.
8. Установить production URL Vercel как URL кнопки меню в BotFather.
9. Выполнить production smoke checklist внутри Telegram.

## Выбор региона

Регион Supabase выбирается до создания production-проекта. Для MVP используется стабильный доступный европейский регион, после чего реальный доступ проверяется из целевого Telegram-окружения.

Окончательный выбор подтверждается открытием развёрнутого Mini App через Telegram в реальной сети пользователя.

## Позиция по VPS и self-hosting

VPS не используется для первого релиза, потому что добавляет дополнительную эксплуатационную работу:

- настройку сервера;
- HTTPS-сертификаты;
- обновление Docker и runtime;
- firewall;
- автоматизацию Postgres backup и проверки восстановления;
- monitoring и logs;
- обновления безопасности.

При необходимости приложение можно перенести позже. Текущая кодовая база сохраняет этот путь реалистичным: доступ к данным находится в сервисах, бизнес-логика — в Edge Functions и серверном коде, миграции — в отдельных файлах, а env — вне кода.

## Резервное копирование и восстановление

Supabase Free не предоставляет managed project backups для этого production-проекта. Поэтому MVP использует ежедневный logical backup, который создаётся на Windows-компьютере владельца и хранится вне репозитория.

- Целевой RPO: `24 часа`; backup старше `72 часов` считается критическим нарушением.
- Целевой RTO: `4 часа`.
- Восстановление проверяется только в изолированной non-production БД Postgres.
- Recovery drill выполняется минимум раз в квартал и перед destructive contract cleanup.
- Актуальная процедура и правила локального хранения описаны в `notes/backup-and-restore.md`.

## Резервные варианты

Если Vercel недоступен из целевого окружения:

1. Оставить Supabase Cloud для backend и данных.
2. Перенести frontend к другому провайдеру статического HTTPS-хостинга.
3. Обновить `VITE_SUPABASE_URL`, пересобрать frontend и изменить URL в BotFather.

Если недоступен Supabase Cloud:

1. Повторно оценить альтернативы managed Postgres и serverless functions.
2. Рассматривать VPS/self-hosting как отдельный инфраструктурный проект.

## Открытые вопросы перед первым деплоем

- Какой регион Supabase доступен и стабилен для целевого окружения пользователя?
- Какой домен используется первым: стандартный домен Vercel или собственный?
- Достаточно ли текущего плана Supabase для `pg_cron` и ожидаемой нагрузки?
- Доступен ли ключ OpenRouter из Supabase Edge Functions в выбранном регионе?

## Инструменты разработки в production

На первом этапе production-тестирования `DEV_TOOLS_ENABLED` намеренно включён:

```env
DEV_TOOLS_ENABLED="true"
```

Dev tools по-прежнему требуют прохождения двух проверок:

- frontend показывает панель только при `appUser.role === "admin"`;
- `supabase/functions/dev-tools` выполняет действия только при server env `DEV_TOOLS_ENABLED="true"` и `users.app_role = 'admin'`.

Это текущее решение для периода запуска и тестирования. После первого стабильного production-запуска dev tools нужно отключить либо сократить доступные production-действия до более безопасного набора.

## Связанные документы

- `notes/production-env.md`;
- `notes/production-deploy-flow.md`;
- `notes/production-readiness.md`;
- `notes/backup-and-restore.md`;
- `notes/server-side-data-guards.md`;
- `notes/security-threat-model.md`;
- `docs/agents/LOCAL_TELEGRAM_RUN.md`.
