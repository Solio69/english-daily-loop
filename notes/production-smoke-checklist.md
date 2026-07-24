# Production smoke checklist

## Purpose

Этот чеклист нужен для ручной проверки production-деплоя `english-daily-loop` после первого запуска и перед следующими production-релизами.

Проверки выполняются в Telegram Mini App через production BotFather menu URL, а не в обычном браузере. В браузере нет `Telegram.WebApp.initData`, поэтому auth там ожидаемо не проходит.

## Release Context

- [ ] Production URL: `https://english-daily-loop.vercel.app`
- [ ] Supabase project: `english-daily-loop-prod`
- [ ] Проверяется актуальный Vercel production deployment.
- [ ] Версия в `package.json`, `currentRelease` и `CHANGELOG.md` совпадает.
- [ ] Известен Git commit SHA текущего Vercel deployment.
- [ ] Проверяется актуальная версия Supabase Edge Functions.
- [ ] Проверяющий пользователь имеет роль `admin` в `public.users.app_role`, если нужно проверить dev tools.

## Critical Path

- [ ] Приложение открывается из Telegram bot menu.
- [ ] Telegram auth проходит без ошибки `initData`.
- [ ] Новый пользователь создается в `public.users`.
- [ ] Для нового пользователя роль по умолчанию `tester`.
- [ ] Пользователь видит экран настроек, если настройки еще не заполнены.
- [ ] Настройки уровня и времени чтения сохраняются.
- [ ] После сохранения настроек открывается главный экран.
- [ ] Главный экран показывает актуальный дневной прогресс.
- [ ] Экран `Текст` открывается из нижней навигации.
- [ ] Генерация текста запускается и завершается успешно.
- [ ] Сгенерированный текст соответствует выбранному уровню и времени чтения.
- [ ] После генерации уменьшается счетчик дневных попыток.
- [ ] Текст можно завершить.
- [ ] Завершенный текст попадает в `Мои материалы` -> `Тексты`.
- [ ] После завершения чтения главный экран предлагает перейти к словам, если повторение еще нужно.

## Vocabulary And Review

- [ ] Из активного текста можно сохранить слово.
- [ ] Сохраненное слово появляется в `Мои материалы` -> `Словарь` как карточка для подготовки.
- [ ] Подготовка карточек запускается из словаря.
- [ ] После подготовки карточка становится готовой без ручного подтверждения.
- [ ] Готовая карточка попадает в дневное повторение.
- [ ] Экран `Слова` открывается из нижней навигации.
- [ ] Закрытая карточка показывает слово и кнопку `Показать перевод`.
- [ ] После открытия карточки видны перевод, часть речи, формы глагола при наличии и примеры.
- [ ] Действия интервалов работают: `Не помню`, текущий шаг, следующий шаг, шаг через один.
- [ ] После действия карточка исчезает из текущей очереди.
- [ ] После завершения всех карточек экран показывает завершенное повторение.
- [ ] Главный экран обновляет прогресс повторения после возврата.

## Support Report

- [ ] Экран `Настройки` открывается.
- [ ] Блок отчета об ошибке отображается.
- [ ] После блока отчета отображается карточка `Версия приложения` с номером текущего релиза.
- [ ] Release notes не открываются автоматически.
- [ ] `Что нового` открывает modal с версией, датой и пунктами только последнего релиза.
- [ ] Modal закрывается крестиком и `Escape`, а повторное открытие не зависит от storage или сети.
- [ ] Модальное окно отчета открывается.
- [ ] Комментарий можно ввести.
- [ ] Отчет отправляется без ошибки.
- [ ] Пользователь видит report id.
- [ ] Запись появляется в `public.support_reports`.
- [ ] В отчете есть safe diagnostics: current screen, app context, client events, request ids.
- [ ] `app_context` содержит ожидаемые `appVersion`, `environment = production` и `buildId`, совпадающий с Vercel Git commit SHA.
- [ ] В отчете нет Telegram `initData`, токенов, secrets, prompt, raw AI response, полного generated text и stack trace.

## Admin And Internal Access

- [ ] Пользователь с `app_role = 'admin'` видит dev tools в настройках.
- [ ] Dev tools раскрываются и сворачиваются.
- [ ] Admin получает paid-like лимиты без строки в `user_subscriptions`.
- [ ] Пользователь с `app_role = 'tester'` не видит dev tools.
- [ ] Tester получает paid-like лимиты без строки в `user_subscriptions`.
- [ ] Пользовательский subscription entry скрыт.
- [ ] Edge Function `activate-subscription` не доступна при `SUBSCRIPTION_FLOW_ENABLED="false"`.

## Direct Data Access Guard

Эти проверки можно выполнить через Supabase SQL/API отдельно от пользовательского UI.

- [ ] Защищенные таблицы закрыты для прямого `anon`/`authenticated` доступа.
- [ ] Critical RPC доступны только через `service_role`.
- [ ] Frontend не пишет напрямую в `users`, `user_settings`, reading, subscription, vocabulary review и support tables.
- [ ] Edge Functions используют server-side Telegram auth.

## Observability

- [ ] Ошибки Edge Functions видны в Supabase logs с request id.
- [ ] AI generation attempts пишут safe metadata в `reading_generation_attempts`.
- [ ] Vocabulary card generation attempts пишут safe metadata в `vocabulary_card_generation_attempts`.
- [ ] Failed AI generation возвращает user-facing ошибку без provider raw response.
- [ ] Support report помогает связать пользовательскую ошибку с request id.

## Regression Checks

- [ ] Светлая тема выглядит корректно.
- [ ] Темная тема выглядит корректно.
- [ ] Нижняя навигация не перекрывает основной контент.
- [ ] Back navigation из `Материалы` / `Словарь` / `Настройки` возвращает на ожидаемый экран.
- [ ] Страница не требует horizontal scroll на мобильном viewport.
- [ ] Обычное открытие production URL в браузере показывает безопасную ошибку Telegram auth, а не белый экран.

## Result

Заполнить после прохождения smoke:

```text
Date:
Tester:
Deployment:
Supabase project:
Result: pass / fail
Known issues:
Follow-up tasks:
```

Tag и GitHub Release создаются только после результата `pass`.

## Related Docs

- `notes/production-deploy-flow.md`
- `notes/production-env.md`
- `notes/production-readiness.md`
- `notes/support-diagnostics.md`
- `notes/server-side-data-guards.md`
