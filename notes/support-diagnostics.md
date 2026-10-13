# Support diagnostics

## Purpose

Пользователь может вручную отправить отчет об ошибке из экрана настроек. Отчет нужен для разбора проблем без доступа к устройству пользователя и без копирования сырых логов в чат.

## UI flow

1. Пользователь открывает `Настройки`.
2. Блок `Отчет об ошибке` предлагает приложить описание и последние события.
3. По кнопке `Отправить` открывается модальное окно.
4. Пользователь видит предупреждение не указывать пароли, контакты и другие личные данные и вводит обязательный комментарий.
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
3. Находит пользователя по `telegram_user_id`, полученному только из валидного `initData`.
4. Дальше использует только внутренний `user_id` и проверяет по нему rate limit: не больше `5` отчетов за последний час на пользователя.
5. Санитизирует `appContext`, `events`, `requestIds` и `aiDiagnostics`, ограничивает размер вложенных объектов и принимает только корректный формат request id.
6. Гарантирует размер diagnostic snapshot не больше `100KB`; при превышении последовательно удаляет самые старые events, AI diagnostics и request ids, затем сокращает app context.
7. Сохраняет отчет в `public.support_reports` через `SUPABASE_SERVICE_ROLE_KEY`.

Frontend не имеет прямого доступа к `public.support_reports`.

## Stored data

`public.support_reports` хранит:

- `user_id`
- `app_role`
- `current_screen`
- `user_comment`
- `app_context`
- `events`
- `request_ids`
- `ai_diagnostics`
- `report_date`
- `created_at`

Совместимый столбец `telegram_user_id` nullable и не заполняется новыми отчетами. Он остается в схеме до отдельного contract cleanup; идентичность нового отчета хранится только через `user_id`.

Разрешенные данные в отчете:

- версия приложения, build id и тип окружения из безопасных compile-time metadata
- внутренний `appUserId`
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
- прямой Telegram ID

## Retention

Отчеты хранятся `30` дней. Миграция `supabase/migrations/20260707120000_add_support_reports.sql` создает scheduled cleanup job:

```sql
cleanup_support_reports
```

## Processing workflow

На текущем объеме отчеты обрабатываются вручную через последовательные read-only запросы из
`.agents/skills/english-daily-loop-support-triage/references/sql.md`. Admin UI, отдельный
реестр обработанных отчетов и lifecycle-поля в БД не используются.

При работе с production агент сначала явно сообщает: `Мы работаем с production БД`. Если у
агента нет прямого read-only доступа, владелец выполняет в Supabase SQL Editor по одному
`SELECT`-запросу и передает только минимальный безопасный результат. Агент ждет результат
текущего шага и только затем выбирает следующий запрос.

1. Выполнить count/date summary. Если `total_reports = 0`, завершить проверку без раскрытия snapshot.
2. Если отчеты есть, получить минимальный список: report id, дату, роль, экран, комментарий,
   release metadata и только счетчики diagnostics. Первичная выборка не содержит `user_id`,
   `telegram_user_id`, полные `events`, `request_ids`, `ai_diagnostics` или `app_context`.
3. Выбрать конкретные `support_reports.id` в scope. Тестовые и явно исключенные записи дальше
   не раскрывать.
4. Для одного выбранного id запросить только релевантные безопасные поля. Не использовать
   `select *` и не выгружать полный diagnostic snapshot.
5. Сопоставить безопасные доказательства:
   - release metadata — с актуальным deployment;
   - `request_ids` — с Edge/API логами;
   - отфильтрованные client events — с пользовательским сценарием;
   - `ai_diagnostics` — со stage, model и `promptVersion`;
   - AI metadata — с `public.reading_generation_attempts` или
     `public.vocabulary_card_generation_attempts` в ограниченном временном окне рядом с отчетом.
6. Отделить подтвержденные факты от гипотез и присвоить отчету ровно одну классификацию.
7. Сразу перенести actionable evidence в карточку проекта или обзор фичи, потому что
   исходный отчет автоматически удалится через `30` дней.

Во время triage строки `public.support_reports` не изменяются и не удаляются. Агент не применяет
миграции, не выполняет deploy и не запускает SQL с побочными эффектами.

## Классификация и маршрутизация

- `тест / шум` — действий не требуется; дополнительные поля отчета не запрашиваются.
- `дубликат` — используется существующая карточка бага или обзор фичи; новый элемент не
  создается, в существующий переносится только новая безопасная evidence.
- `внешний инцидент` — фиксируются причина и восстановление; код не меняется без отдельного
  подтвержденного дефекта приложения.
- `наблюдаем` — данных недостаточно для подтверждения; кейс передается в карточку проекта со
  статусом `наблюдаем`.
- `bug` — создается или обновляется карточка через канонический skill
  `.agents/skills/triage-english-daily-loop-bugs/SKILL.md`. Сам support triage не дает
  допуска к изменению кода.
- `improvement / feature` — создается или обновляется обзор фичи через канонический skill
  `.agents/skills/english-daily-loop-feature-spec/SKILL.md`. Изменение продуктового правила
  не маскируется под баг.

Перед созданием карточки или обзора сначала проверяется отсутствие дубликата. Дальнейшее
согласование и допуск к реализации выполняются только по соответствующему каноническому
workflow и `D:\anastasiaStorage\Проекты\English daily loop\_work\SDD workflow English Daily Loop.md`.

## Data minimization during triage

- Запрашивать по одному только те поля, которые нужны для текущей диагностической гипотезы.
- Не включать `user_id` и `telegram_user_id` в результаты SQL. Внутренний `user_id` допустим
  только внутри server-side `join` для корреляции и не должен попадать в `select`.
- Не запрашивать и не переносить Telegram `initData`, токены, secrets, полный prompt, raw
  provider response, generated content, stack trace, полный `app_context` или полные `events`.
- Пользовательский комментарий считать потенциально чувствительным. Перед передачей в чат или
  долговременную документацию удалять контакты, credentials и другие личные данные.
- В карточку бага, обзор фичи или эксплуатационную заметку переносить только report id, дату,
  безопасный краткий пересказ, релевантные request id и минимальные доказательства диагноза.
  Не копировать исходный комментарий и весь snapshot целиком.
- Использовать только синтетические значения в примерах документации.

## Security notes

- Таблица закрыта для `anon` и `authenticated`.
- Запись выполняется только через Edge Function.
- `requestId` не является секретом; он нужен для корреляции клиентского события, server log и записи в БД.
- Для корреляции пользователя используются внутренние `appUserId`/`user_id`; прямой Telegram ID не передается во frontend context и прикладные логи.
- Санитизация есть на клиенте и на сервере, но source of truth по безопасности остается сервер.
