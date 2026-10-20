# Контракт данных отчёта F16

## HTTP и результат

POST `submit-support-report` принимает Telegram `initData`, обязательный comment, currentScreen, appContext, events, requestIds и aiDiagnostics. Ответ успеха сохраняет `reportId` и `createdAt`; превышение лимита даёт `429 SUPPORT_REPORT_RATE_LIMITED`. Некорректная авторизация и DB error не раскрывают внутренние данные.

## Допустимая диагностика

- `appContext`: только appVersion, buildId, environment, appUserId, role, settings (englishLevel, dailyReadingMinutes), subscription (tier, accessType, limits: dailyReadingGenerations, vocabularyWordsLimit), homeProgress (lesson.status/currentStep, reading.status, review.status/dueCount/reviewedTodayCount), streakDays, userAgent, viewport (width, height), telegramColorScheme.
- `events`: только event names `screen_opened`, `edge_request_started`, `edge_request_succeeded`, `edge_request_failed`, `edge_request_diagnostics`, `reading_position_save_failed`, `support_report_submitted`. Envelope: id, createdAt, level, event, details. Details зависят от типа: screen_opened → currentScreen/role; edge_request_* → functionName/requestId/code/diagnostics; reading_position_save_failed → readingTextId/paragraphIndex; support_report_submitted → reportId. Неизвестный тип или поле отбрасывается.
- `aiDiagnostics` и nested event diagnostics: functionName, requestId, promptVersion, modelChain, model, stage, durationMs, completionTokens, reasoningTokens, providerStatus, providerErrorCode, targetLevel, readingMinutes, targetWordMin/Max, validationWordMin/Max, outputWordCount, englishLevel, requestedCount, preparedCount, failedCount. Полный prompt, raw response и свободный error text не входят.
- `requestIds`: только текущий формат request ID, максимум 50 уникальных. Сохраняются последние 100 событий и 20 AI diagnostic entries. Любая строка ограничена длиной, вложенные структуры имеют фиксированную схему, общий snapshot — не более 100 KiB.

## Redaction

Во всех строках до усечения длины удаляются прямой Telegram ID, известные URL/form и JSON-пары `initData`, `hash`, `auth_date`, `query_id`, `user`, `token`, `api_key`, `secret`, `password`, `authorization`, Bearer credential, Telegram bot-token и OpenRouter `sk-`-подобные значения. Комментарий и currentScreen проходят тот же слой. Неизвестный секрет произвольного формата не распознаётся гарантированно; предупреждение пользователю остаётся.

## RPC

`public.submit_support_report(p_user_id uuid, p_app_role text, p_current_screen text, p_user_comment text, p_app_context jsonb, p_events jsonb, p_request_ids text[], p_ai_diagnostics jsonb) returns jsonb`. Доступна только service_role. Возвращает `{reportId, createdAt}` либо стабильный SQL error `SUPPORT_REPORT_RATE_LIMITED`. Сериализация через row lock пользователя, один DB timestamp, окно `(now - interval '1 hour', now]`, предел 5.
