# Ссылка обратной связи

## 1) Назначение

В приложении есть простая ссылка обратной связи для MVP. Она открывает Telegram
профиль разработчика из экрана `Настройки`.

Функционал не создает обращения в БД, не отправляет server request и не собирает
технический контекст ошибки. Это публичная frontend-ссылка для быстрого личного
контакта.

## 2) Настройка

Username задается через frontend env:

```env
VITE_FEEDBACK_TELEGRAM_USERNAME="my_username"
```

Значение указывается без `@`. Переменная публичная, потому что попадает во
frontend bundle. Не использовать ее для секретов.

Если переменная пустая или не похожа на Telegram username, блок обратной связи
не показывается.

## 3) UI

Экран:
- `src/screens/SettingsScreen.tsx`

Паттерн:
- footer-style строка под настройками;
- muted текст `Есть вопрос?`;
- warm-accent ссылка `Написать разработчику`;
- иконка `ExternalLink`;
- без hover background, full border, glow, primary CTA веса и отдельной карточки.

Актуальные дизайн-правила зафиксированы в
`docs/DESIGN_SYSTEM.md`.

## 4) Открытие ссылки

Helper:
- `src/utils/telegramLinks.ts`

Поведение:
- `getTelegramProfileUrl(...)` нормализует username, убирает начальный `@`,
  валидирует допустимые символы и возвращает `https://t.me/<username>`;
- `openTelegramLink(...)` внутри Telegram Mini App использует
  `window.Telegram.WebApp.openTelegramLink`;
- вне Telegram открывает ссылку через `window.open`;
- в не-browser окружении возвращает `false`.

Тип Telegram WebApp расширен в:
- `src/types/telegram-webapp.d.ts`

## 5) Проверки

Unit-тесты:
- `tests/telegramLinks.test.ts`

Проверяются валидные username, username с начальным `@` и невалидные значения.
