# Home progress, урок и верхние toast'ы

## 1) Область документа
Этот документ фиксирует текущую модель главного экрана:
- серверный `homeProgress` для карточек на главной
- server-side `streakDays` для счетчика с иконкой огонька
- единый верхний toast-компонент для app-level сообщений

## 2) Home progress для главной
Источник истины для карточек на главной:
- `public.user_daily_reading_completions`
- `public.user_active_reading_texts`

Сервер собирает в `auth-telegram`:
- `homeProgress.lesson.status`
- `homeProgress.lesson.currentStep`
- `homeProgress.reading.status`
- `streakDays`

Текущая модель lesson для главной:
- daily lesson пока состоит только из чтения
- `currentStep = "reading"`, пока урок не завершен
- `currentStep = null`, когда урок завершен

Текущая модель чтения:
- `not_started` — на сегодня нет активного текста и нет completion
- `in_progress` — есть активный текст, но completion на сегодня нет
- `completed` — на сегодня уже есть completion

Текущая модель streak:
- `streakDays` считается сервером по серии подряд идущих дат в `user_daily_reading_completions`
- timezone серии: `Europe/Moscow`

## 3) Где это используется
Backend:
- `supabase/functions/auth-telegram/index.ts`
- `supabase/functions/complete-reading-text/index.ts`

Frontend:
- `src/types/homeProgress.ts`
- `src/types/user.ts`
- `src/services/userService.ts`
- `src/App.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/ReadingScreen.tsx`

## 4) Поведение UI
Карточка урока на главной:
- заголовок `Урок на сегодня`
- кнопка `Начать`, если урок еще не начат
- кнопка `Продолжить`, если чтение уже начато
- бейдж `Завершено`, если урок завершен
- нажатие на кнопку ведет сразу на экран чтения

Карточка `Прогресс за день`:
- статус `Текст` показывает `homeProgress.reading.status`
- `Не начато` — серый
- `В процессе` — оранжевый
- `Готово` — зеленый

Счетчик с иконкой огонька:
- показывает `streakDays`
- после завершения текста обновляется на клиенте сразу из ответа `complete-reading-text`
- после нового bootstrap получает актуальное значение из `auth-telegram`

Локальные обновления на клиенте:
- после генерации текста `lesson.status` и `reading.status` переходят в `in_progress`
- после завершения текста `lesson.status` и `reading.status` переходят в `completed`
- если генерация упала, экран чтения повторно запрашивает `get-reading-state`, чтобы синхронизировать активный текст и оставшиеся попытки

## 5) Toast component
Верхние app-level сообщения проходят через единый компонент:
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
- Daily lesson на главной пока агрегирует только чтение; упражнения и слова еще не участвуют
  в server-side расчете lesson progress.
