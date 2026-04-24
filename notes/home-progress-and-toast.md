# Home progress и верхние toast'ы

## 1) Область документа
Этот документ фиксирует два свежих изменения MVP:
- серверный `homeProgress` для главного экрана
- единый верхний toast-компонент для app-level сообщений

## 2) Home progress для главной
Источник истины для блока `Текст` на главной:
- `public.user_daily_reading_completions`
- `public.user_active_reading_texts`

Сервер собирает `homeProgress.reading.status` в `auth-telegram`:
- `not_started` — на сегодня нет активного текста и нет completion
- `in_progress` — есть активный текст, но completion на сегодня нет
- `completed` — на сегодня уже есть completion

## 3) Где это используется
Backend:
- `supabase/functions/auth-telegram/index.ts`

Frontend:
- `src/types/homeProgress.ts`
- `src/types/user.ts`
- `src/services/userService.ts`
- `src/App.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/ReadingScreen.tsx`

## 4) Поведение UI
Блок `Текст` в карточке `Прогресс за день` показывает:
- `Не начато` — серый
- `В процессе` — оранжевый
- `Готово` — зеленый

После генерации текста статус обновляется на клиенте сразу до `in_progress`.
После завершения текста статус обновляется сразу до `completed`,
без повторного bootstrap приложения.

## 5) Toast component
Все верхние app-level сообщения теперь проходят через единый компонент:
- `src/components/Toast.tsx`

Поддерживаемые тоны:
- `default`
- `onboarding`
- `success`
- `error`

Правила цветов:
- `onboarding` — белый текст на розовом фоне
- `success` — зеленый в светлой теме, оранжевый в темной
- `error` — `#DD3D4C`

## 6) Ограничения
- Сейчас toast-слой живет в `App.tsx` и работает как единый глобальный канал только
  для верхних app-level сообщений.
- Временные локальные тестовые рендеры toast'ов перед коммитом нужно удалять вручную,
  если они были добавлены для визуальной проверки.
