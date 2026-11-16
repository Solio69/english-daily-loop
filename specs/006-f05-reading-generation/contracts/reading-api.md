# Сохраняемый контракт чтения для F05–F07

Документ описывает действующий внешний контракт, который должен сохраняться при рефакторинге. Подробные значения error code и сообщения закрепляются контрактными тестами до изменения обработчиков. Все endpoints требуют POST и Telegram initData, проверяемый сервером. Ответы используют общий envelope ok/data или error; клиентские ключи и server-only secrets в ответ не включаются.

## F05: generate-reading-text

Вход: initData; request ID передаётся общим function client. Настройки уровня и длительности загружаются сервером, а не доверяются телу клиента.

Успех: data.text с id, title, body, level, estimatedMinutes, lastReadParagraphIndex; data.generation с provider, model, fallbackUsed, promptVersion; dailyLimit, usedAttempts, remainingAttempts. Появляется один активный текст и одна успешная попытка. Повтор с тем же request ID не расходует вторую попытку и не вызывает AI заново.

Ошибки: неверный auth, отсутствие настроек, исчерпанный лимит, неправильная model config, provider/validation/DB failure и состояния повторного request ID сохраняют действующие HTTP status/code/message. Диагностика ограничена безопасными полями F04.

## F06: get-reading-state

Успех: today, dailyLimit, usedAttempts, remainingAttempts, isReadingCompletedToday, activeText. activeText либо null, либо содержит id/title/body/level/estimatedMinutes/lastReadParagraphIndex, savedWordIndexes и pendingSavedWordIndexes, source, generation. Активный текст не зависит от даты его генерации; today и счётчики относятся к текущему учебному дню с границей 05:00 Europe/Moscow.

## F06: save-reading-position

Вход: initData, readingTextId, paragraphIndex. paragraphIndex — null или индекс 0..N-1 по действующему серверному разбиению абзацев. Успех: readingTextId, paragraphIndex. Отсутствующий, чужой или замещённый текст не обновляется.

## F06: complete-reading-text

Вход: initData. Успех: completedDate, firstTextCompletedAt, isReadingCompletedToday, streakDays, completedReadingTextCount. База атомарно переносит активный текст в историю и дневную отметку по своему timestamp. Последние две метрики остаются best-effort.

## F06: get-reading-history

Вход: initData, cursor, limit. Существующий limit приводится к диапазону 1..30, default 10. Cursor строится из completed_at и id. Успех: items и nextCursor. Порядок completed_at DESC, id DESC. Чужие тексты не возвращаются.

## F07: клиентские границы

readingService преобразует успешную генерацию в ReadingText, добавляя source ai и generation. Неясный результат сетевого запроса повторяется с тем же request ID; затем экран читает get-reading-state для восстановления. При действиях со словом используются существующие save-vocabulary-word/delete-pending-vocabulary-word и индексы слов из get-reading-state. Материалы продолжают использовать get-reading-history без изменения UI.
