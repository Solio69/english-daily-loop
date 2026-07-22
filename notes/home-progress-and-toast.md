# Home progress, урок и app-level toast'ы

## 1) Область документа
Этот документ фиксирует текущую модель главного экрана:
- серверный `homeProgress` для карточек на главной
- server-side `streakDays` для счетчика с иконкой огонька
- server-side `completedReadingTextCount` для плитки текстов
- единый toast-компонент для app-level сообщений

## 2) Home progress для главной
Источник истины для карточек на главной:
- `public.user_daily_reading_completions`
- `public.user_active_reading_texts`
- `public.user_daily_vocabulary_review_completions`
- `public.user_vocabulary_words`
- `public.user_completed_reading_texts`

Общий server helper `supabase/functions/_shared/home-progress.ts` собирает только
состояние дневного плана:
- `homeProgress.lesson.status`
- `homeProgress.lesson.currentStep`
- `homeProgress.reading.status`
- `homeProgress.review.status`
- `homeProgress.review.dueCount`
- `homeProgress.review.reviewedTodayCount`

`auth-telegram` объединяет `homeProgress` с отдельными производными метриками:
- `streakDays` из `supabase/functions/_shared/reading-streak.ts`
- `completedReadingTextCount` из `supabase/functions/_shared/reading-history.ts`

Счетчик истории не является условием успешного bootstrap. При временной ошибке
агрегатного запроса сервер логирует ошибку и возвращает `null`, а приложение
продолжает загрузку с нейтральной подписью плитки текстов.

Текущая модель lesson для главной:
- daily lesson состоит из чтения и повторения слов;
- `currentStep = "reading"`, пока не завершено чтение;
- `currentStep = "vocabulary"`, когда чтение завершено, а повторение еще нет;
- `currentStep = null`, когда урок завершен

Текущая модель чтения:
- `not_started` — на сегодня нет активного текста и нет completion
- `in_progress` — есть активный текст с `reading_date` текущей московской даты, но completion на сегодня нет
- `completed` — на сегодня уже есть completion; это значит, что пользователь завершил хотя бы один текст, но не запрещает читать дополнительные тексты в тот же день

Текущая модель повторения:
- `not_started` — обязательная очередь не пуста, ответов за сегодня еще нет;
- `in_progress` — пользователь повторил часть обязательной очереди;
- `completed` — обязательная очередь пуста и дневной completion-marker сохранен;
- если карточек на день нет, completion-marker создается с `reviewed_count = 0`;
- новые карточки после completion доступны дополнительно и не открывают план заново.
- `homeProgress.review` использует счетчики обязательного плана. Дополнительные
  карточки после completion отображаются в display-счетчиках экрана `Слова`, но не
  меняют статус и счетчики главной.

Текущая модель streak:
- `streakDays` считается сервером по серии подряд идущих дат в `user_daily_reading_completions`
- timezone серии: `Europe/Moscow`
- серия начинается с текущей московской даты; если completion-marker за сегодня отсутствует,
  `streakDays = 0`
- расчет находится в `supabase/functions/_shared/reading-streak.ts`
- `useAppUserProfile` обновляет профиль при возврате в приложение, переходе страницы в visible-state
  и смене московской даты, чтобы главная не держала устаревшую серию после пропуска дня

## 3) Где это используется
Backend:
- `supabase/functions/auth-telegram/index.ts`
- `supabase/functions/save-user-settings/index.ts`
- `supabase/functions/complete-reading-text/index.ts`
- `supabase/functions/get-vocabulary-review-state/index.ts`
- `supabase/functions/review-vocabulary-word/index.ts`
- `supabase/functions/_shared/home-progress.ts`
- `supabase/functions/_shared/reading-history.ts`
- `supabase/functions/_shared/reading-completion-metrics.ts`

Frontend:
- `src/types/homeProgress.ts`
- `src/types/user.ts`
- `src/hooks/useAppUserProfile.ts`
- `src/hooks/useAppUserActions.ts`
- `src/hooks/useToast.ts`
- `src/services/userService.ts`
- `src/services/materialsService.ts`
- `src/App.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/MaterialsScreen.tsx`
- `src/screens/ReadingScreen.tsx`
- `src/screens/VocabularyScreen.tsx`
- `src/utils/homeProgressPresentation.ts`
- `src/utils/navigationAccess.ts`

## 4) Поведение UI
Главная страница:
- использует full-bleed `Layout` без внешнего app shell, потому что внешний frame дает Telegram
- ограничивает контент по ширине для мобильной плотности: до `430px` на mobile и до `390px` на desktop/wide preview
- использует glass-карточки, CSS-токены из `src/index.css`, локальные шрифты Inter/Manrope и иконки `lucide-react`

Header главной:
- в верхней строке показывает приветствие `С возвращением,` слева
- справа в верхней строке показывает трехпозиционный переключатель темы и кнопку настроек
- переключатель темы содержит режимы `Как в Telegram`, `Светлая тема` и `Темная тема`
- кнопка настроек использует теплый accent-state и остается заметной в обычном и onboarding-состоянии
- имя пользователя находится строкой ниже слева
- кнопка подписки находится на уровне имени пользователя справа
- длинное имя переносится и получает меньший размер шрифта
- кнопки header имеют одинаковую высоту `36px`

Карточка `Прогресс за день`:
- заголовок `Прогресс за день` находится слева
- streak с иконкой огонька находится справа в header карточки
- показывает два шага дневного цикла: `Текст` и `Повторение`
- статус `Текст` показывает `homeProgress.reading.status`
- статус `Повторение` показывает `homeProgress.review.status`
- `not_started` отображается как `Не начато`
- `in_progress` отображается как `В процессе`
- `completed` отображается как `Готово`
- `completed` при `dueCount = 0` и `reviewedTodayCount = 0` отображается как `На сегодня нет слов`
- текущий шаг использует теплый акцент `--accent-warm`
- завершенный шаг использует основной акцент `--primary`
- нижние плашки показывают минуты текста и текущее количество обязательных слов;
- при пустой очереди плашка повторения показывает `Слова`;
- плашка времени чтения использует теплый акцент в состоянии `in_progress`, основной акцент в состоянии `completed` и нейтральный glass state в состоянии `not_started`
- плашка повторения использует те же status-цвета: neutral, warm и primary.

Карточка `План на сегодня`:
- показывает короткое описание текущего состояния урока
- описание может переноситься по предложениям на отдельные строки
- кнопка `Начать` отображается, если урок еще не начат
- кнопка `Продолжить` отображается, если чтение уже начато
- бейдж `Завершено` отображается, если урок завершен
- нажатие ведет на экран текущего шага: `Текст` или `Слова`.

Карточка `Мои материалы`:
- находится на главной под дневным планом
- содержит две плитки фиксированной высоты: `Тексты` и `Словарь`
- плитки сохраняют одинаковую высоту во время загрузки и после получения состояния словаря
- иконки и заголовки в плитках выровнены на одном уровне
- плитка `Тексты` открывает экран материалов на табе текстов
- плитка `Тексты` показывает общее количество завершенных текстов как `Прочитано: N текст/текста/текстов`
- если server-side счетчик временно недоступен, плитка показывает `История чтения`
- плитка `Словарь` открывает экран материалов на табе словаря
- плитка `Словарь` запрашивает `get-vocabulary-state` и показывает короткий статус: `Добавить: N` или `В словаре: N`
- статус `Добавить` выделяется теплым акцентом в светлой и темной теме
- таб `Тексты` показывает историю завершенных чтений
- таб `Словарь` открывает словарь с подготовкой и просмотром карточек слов

Нижняя навигация:
- фиксируется снизу viewport
- учитывает `safe-area-inset-bottom`
- использует 4 компактные кнопки: `Главная`, `Текст`, `Слова`, `Материалы`
- пункт `Материалы` использует иконку `LibraryBig` и открывает экран `Мои материалы`
- длинные подписи не растягивают кнопку и обрезаются через `truncate`
- до сохранения первоначальных настроек учебные разделы заблокированы
- после сохранения настроек доступны все пункты, включая `Слова`; завершение первого текста не используется как навигационный guard

Счетчик с иконкой огонька:
- показывает `streakDays`
- после завершения текста обновляется на клиенте сразу из ответа `complete-reading-text`
- после нового bootstrap получает актуальное значение из `auth-telegram`
- после смены московской даты обновляется через повторный запрос профиля

Счетчик завершенных текстов:
- считается server-side через `supabase/functions/_shared/reading-history.ts`
- учитывает каждую строку `user_completed_reading_texts`, включая несколько текстов за одну дату
- приходит при bootstrap из `auth-telegram`
- после завершения текста обновляется из ответа `complete-reading-text` без повторной авторизации

Локальные обновления на клиенте:
- после генерации текста `lesson.status` и `reading.status` переходят в `in_progress`
- после завершения первого текста `reading.status` переходит в `completed`, а
  `lesson` вычисляется с учетом текущего `review.status`;
- после ответа на карточку экран повторения обновляет `homeProgress.review` и общий
  статус урока;
- если генерация упала, экран чтения повторно запрашивает `get-reading-state`, чтобы синхронизировать активный текст и оставшиеся попытки

## 5) Toast component
App-level сообщения проходят через единый компонент:
- `src/components/Toast.tsx`
- `src/hooks/useToast.ts`

Позиционирование:
- toast фиксируется сверху viewport
- учитывает `safe-area-inset-top`
- ширина синхронизирована с мобильной шириной приложения: `w-[calc(100%-32px)]`, `max-w-[390px]`

Основной API:
- `AppToast`
- `ToastViewport`

Поддерживаемые variant-состояния:
- `success`
- `warning`
- `error`

Совместимый wrapper `Toast` принимает текущие app-тоны:
- `default`
- `onboarding`
- `success`
- `error`

Правила внешнего вида:
- toast — floating pill-like glass card с `rounded-[28px]`, border, blur и мягкой тенью
- слева круглый icon container
- в центре title и optional description
- справа кнопка закрытия
- `success` использует blue/cyan и `Check`
- `warning` использует amber/orange и `TriangleAlert`
- `error` использует red/coral и `XCircle`
- `default` и `onboarding` мапятся на `warning`
- появление использует `app-toast-enter`

Тексты onboarding-состояний:
- для попытки перейти в закрытый раздел до заполнения настроек используется `Открой настройки, чтобы продолжить.`

## 6) Inline status и loading primitives

Для статусов внутри экранов используется `src/components/InlineStatusCard.tsx`.

Назначение:
- встроенные error/completed/info/warning состояния внутри content flow;
- состояние завершенного чтения на экране `Текст`;
- ошибки генерации текста внутри экрана `Текст`.

Для загрузок используется `src/components/LoadingState.tsx`.

Назначение:
- bootstrap профиля;
- загрузка состояния чтения;
- генерация текста;
- загрузка материалов и словаря;
- fallback lazy dev tools.

## 7) Ограничения
- Сейчас toast-слой живет в `App.tsx` и работает как единый глобальный канал только
  для app-level сообщений.
- Streak пока считается только по завершениям чтения и не зависит от повторения слов.
