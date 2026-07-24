# Support diagnostics

## Purpose

Пользователь может вручную отправить отчет об ошибке из экрана настроек. Отчет нужен для разбора проблем без доступа к устройству пользователя и без копирования сырых логов в чат.

## UI flow

1. Пользователь открывает `Настройки`.
2. Блок `Отчет об ошибке` предлагает приложить описание и последние события.
3. По кнопке `Отправить` открывается модальное окно.
4. Пользователь вводит комментарий. Комментарий обязателен.
5. Frontend берет последние client events из `sessionStorage`, добавляет безопасный app context и вызывает Edge Function `submit-support-report`.
6. После успешной отправки отчет сохраняется в `public.support_reports`, а пользователь видит сообщение `Отчет отправлен. Спасибо!`.

UI блока и модального окна находится в `src/components/settings/SupportReportCard.tsx`.

## Client diagnostics buffer

Клиентский буфер живет только в текущей browser/sessionStorage-сессии:

- storage key: `edl.diagnostics.events`
- лимит: последние `100` событий
- события добавляются через `src/services/clientLogger.ts`
- `src/services/functionClient.ts` добавляет `x-request-id` к каждому вызову Edge Function и пишет события `edge_request_started`, `edge_request_succeeded`, `edge_request_failed`
- `src/services/edgeFunctionErrors.ts` нормализует ошибки Edge Functions, request id и diagnostics для пользовательских сообщений и client events
- `App` пишет `screen_opened` при смене экрана

Локальный буфер не отправляется автоматически. Он попадает на сервер только при ручной отправке отчета.

## Server flow

`supabase/functions/submit-support-report/index.ts`:

1. Принимает только `POST`.
2. Валидирует Telegram `initData` через `TELEGRAM_BOT_TOKEN`.
3. Находит пользователя по `telegram_user_id`.
4. Проверяет rate limit: не больше `5` отчетов за последний час на пользователя.
5. Санитизирует `appContext`, `events`, `requestIds` и `aiDiagnostics`.
6. Ограничивает diagnostic snapshot до `100KB`; при превышении удаляет самые старые events.
7. Сохраняет отчет в `public.support_reports` через `SUPABASE_SERVICE_ROLE_KEY`.

Frontend не имеет прямого доступа к `public.support_reports`.

## Stored data

`public.support_reports` хранит:

- `user_id`
- `telegram_user_id`
- `app_role`
- `current_screen`
- `user_comment`
- `app_context`
- `events`
- `request_ids`
- `ai_diagnostics`
- `report_date`
- `created_at`

Разрешенные данные в отчете:

- версия приложения, build id и тип окружения из безопасных compile-time metadata
- роль пользователя
- тип доступа и лимиты
- настройки уровня и времени чтения
- текущий экран
- счетчики progress
- request id Edge Function вызовов
- safe AI diagnostics: function name, prompt version, model chain, failed/current model, stage, target/validation ranges, output word count, duration, sanitized provider/validation error

Общий server helper safe AI diagnostics находится в `supabase/functions/_shared/ai-diagnostics.ts`; доменные Edge Functions добавляют к нему только поля своего сценария.

Запрещенные данные:

- Telegram `initData`
- токены, ключи, env/secrets
- полный `process.env`
- полный prompt
- raw AI provider response
- полный generated text
- полный словарь
- stack trace

## Retention

Отчеты хранятся `30` дней. Миграция `supabase/migrations/20260707120000_add_support_reports.sql` создает scheduled cleanup job:

```sql
cleanup_support_reports
```

## Debug workflow

1. Найти свежий отчет в `public.support_reports`.
2. Посмотреть `user_comment` и `current_screen`.
3. Сверить `app_context.appVersion`, `buildId` и `environment` с Vercel deployment; локальный build использует `buildId = local`.
4. Сопоставить `request_ids` с Edge/API логами.
5. Если проблема связана с AI, смотреть `ai_diagnostics` и metadata попыток:
   - `public.reading_generation_attempts`
   - `public.vocabulary_card_generation_attempts`

## Security notes

- Таблица закрыта для `anon` и `authenticated`.
- Запись выполняется только через Edge Function.
- `requestId` не является секретом; он нужен для корреляции клиентского события, server log и записи в БД.
- Санитизация есть на клиенте и на сервере, но source of truth по безопасности остается сервер.
