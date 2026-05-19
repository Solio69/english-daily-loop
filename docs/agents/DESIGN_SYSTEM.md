# Design System: english-daily-loop

Актуальная дизайн-система проекта для mobile-first экранов и общих UI-компонентов.

Цель: компактный mobile-first glass UI для Telegram Mini App. Целевой runtime - мобильный Telegram. Desktop Telegram используется как preview и не должен раздувать интерфейс.

## Базовый принцип

- Telegram уже дает внешний frame Mini App. Не рисовать отдельный внешний app shell.
- `Layout` должен быть full-bleed: `min-h-[100dvh] w-full bg-[var(--background)]`.
- Glass-эффект используется внутри интерфейса: карточки, кнопки, nav, icon controls.
- Главная ограничена по ширине для читаемости:
  - mobile: `max-w-[430px]`
  - desktop/wide preview `480px+`: `max-w-[390px]`, чтобы UI оставался мобильной плотности.

## Технологии

- React + TypeScript + Vite.
- Tailwind CSS 4 через `@tailwindcss/vite`.
- Без `tailwind.config.ts`: токены задаются CSS variables в `src/index.css`.
- Иконки: `lucide-react`.
- Шрифты локально через `@fontsource/inter` и `@fontsource/manrope`.

## Токены

Источник токенов: `src/index.css`.

Главные переменные:

```css
--background
--app-shell
--surface
--surface-strong
--border
--border-strong
--text-primary
--text-secondary
--text-muted
--primary
--primary-soft
--primary-glow
--accent-warm
--accent-warm-soft
--accent-coral
--accent-coral-glow
```

Темы:

- light: pale blue background, translucent white surfaces, blue identity, coral CTA, warm accent for progress/streak.
- dark: deep navy background, cyan/blue identity, warm accent for active progress, coral CTA.

Не использовать green как основной success/accent на главной. Для completed/current состояний использовать `--primary` и `--accent-warm`.

## Utilities

В `src/index.css` есть reusable utilities:

- `.font-heading` - Manrope heading stack.
- `.glass-card` - glass surface for cards.
- `.glass-control` - glass surface for buttons/icon controls/chips.
- `.glass-shell` - utility для внутренних glass-контейнеров; не использовать как внешний shell Telegram Mini App.
- `.shadow-primary-glow`
- `.shadow-coral-glow`
- `.shadow-warm-glow`
- `.onboarding-settings-wave` - wide two-phase warm onboarding wave for the settings button on first setup.

## Shared UI Components

Общие UI primitives:

- `src/components/ScreenHeader.tsx` - compact header with circular glass back button and uppercase screen title.
- `src/components/LoadingState.tsx` - glass loading pill with primary spinner for app-level and screen-level loading states.
- `src/components/InlineStatusCard.tsx` - inline glass status card with circular icon container and variants `success`, `warning`, `error`, `info`.
- `src/components/Button.tsx` - shared CTA/control button; default primary/accent style uses coral background.

Rules:

- Use `ScreenHeader` for internal screens with back navigation.
- Use `LoadingState` instead of ad hoc spinner blocks.
- Use `InlineStatusCard` instead of standalone green/red alert blocks.
- Keep app-level floating messages in `Toast`; use `InlineStatusCard` for status messages inside page content.

## Typography

Fonts:

- Body: `Inter`.
- Headings/UI emphasis: `Manrope`.

Актуальные размеры главной:

- Greeting text `С возвращением,`: `16px`; на `390-479px` используется `17px`.
- User name:
  - normal: max `28px`.
  - long name `> 12` chars: `24px`; на `390px+` используется `26px`.
  - has `py-1` for vertical breathing room.
- Section labels: `16px`, uppercase, `tracking-[0.11em]`.
- Lesson body text: `14px`, `leading-5`.
- Materials tile title `Тексты` / `Словарь`: `16px`.
- Materials tile secondary text: `14px`, `leading-5`.
- Bottom nav label: `9px`; на `390px+` используется `10px`.

## Layout

Use:

```tsx
<div className="min-h-[100dvh] w-full bg-[var(--background)]">
  <main className="flex min-h-[100dvh] w-full flex-col pb-20">
    ...
  </main>
</div>
```

Home content:

```tsx
<div className="
  mx-auto w-full max-w-[430px]
  space-y-3
  px-3.5 pb-3 pt-3
  min-[390px]:px-4
  min-[480px]:max-w-[390px] min-[480px]:px-3
">
```

Responsive breakpoints used in this app:

- `<390px`: compact mobile.
- `390-479px`: primary mobile target.
- `480px+`: Telegram Desktop / wide preview, but keep mobile density with `max-w-[390px]`.

## Header On Home

Structure:

- Top row:
  - left: `С возвращением,`
  - right: subscription button, settings icon button, theme toggle
- Second row:
  - user name only

Rules:

- Header controls must be the same height.
- Current header controls height: `h-9` / `size-9`.
- Subscription button shows full `Подписка`.
- Free subscription button label `Купить` uses `--accent-warm`; paid subscription state uses `--primary`.
- Subscription button icon: `15px`.
- Settings and theme are circular icon-only controls with `aria-label`.
- During first setup, settings button uses `--accent-warm`, `--accent-warm-soft`, `shadow-warm-glow`, and `.onboarding-settings-wave`.
- Streak is not in header; it lives in the progress card header.

## Cards

Base card:

```tsx
<section className="glass-card rounded-[20px] p-3">
```

Spacing:

- Between main blocks on home: `space-y-3` (`12px`).
- Between section title and card content: `mb-2` (`8px`).
- Avoid hidden extra margins on first child after a section label.

## Daily Progress Card

Header:

- left: `Прогресс за день`
- right: streak pill with `Flame`
- streak pill text: `14px`, icon: `15px`.

Progress steps:

- 2 steps on home: `Текст` and `Повторение`.
- icon container: `size-9`; на `390px+` используется `size-10`.
- label: `16px`.
- status text: `14px`, `leading-5`.
- connector width: `80px`; на `390px+` используется `96px`.

Chips:

- 2 columns.
- chip grid uses the same column geometry as progress icons: `grid-cols-[1fr_5rem_1fr]`; on `390px+` -> `grid-cols-[1fr_6rem_1fr]`.
- second chip starts at column 3.
- chip width: `112px`; on desktop/wide preview `96px`.
- chip centers align with progress icon centers.
- compact height: `py-1`.
- reading time chip uses warm accent only when `readingStatus === "in_progress"`.
- reading time chip uses primary/cyan accent when `readingStatus === "completed"`.
- before reading starts, reading time chip uses neutral glass state.
- review/vocabulary chip uses neutral glass state until repeat flow is implemented.

## Lesson Card

Header: `План на сегодня`.

Content:

- description text stays visible.
- description lines may split by sentence into separate lines:
  - `Урок начат.`
  - `Вернись, чтобы закончить чтение.`
- Внутри body карточки не используется дополнительный крупный заголовок.
- CTA is on the right, compact:
  - `min-h-9`
  - `text-xs`
  - coral background via shared `Button`.

## First Setup Card

- Header: `Перед первым уроком`, same section label style as other home blocks.
- Lead text `Заполни настройки перед стартом.`: `16px`, `font-semibold`, normal sentence case, `--accent-warm`.
- Body text: `14px`, `leading-5`, `--text-secondary`.
- CTA `Открыть настройки`: full-width shared `Button`, coral background, `font-heading`, `14px`, `font-semibold`.

## Settings Screen

Purpose:

- User chooses `englishLevel` and `dailyReadingMinutes`.
- Settings screen does not write to DB directly; it calls the existing `onSave` flow.

Layout:

- Uses the same full-bleed app background from `Layout`.
- Inner content width: `max-w-[430px]`, wide preview `max-w-[390px]`.
- Top padding: `pt-3`.
- Header contains a circular glass back button and uppercase `Настройки` label.
- No secondary large header inside the screen header.

Cards:

- Settings groups use `glass-card rounded-[20px] p-3`.
- Section labels use `font-heading`, `16px`, uppercase, `tracking-[0.11em]`, `--primary`.
- Option buttons use fixed compact control height, rounded `[16px]`, `font-heading`, `14px`, `font-semibold`.
- Selected options use warm accent: `--accent-warm`, `--accent-warm-soft`, `shadow-warm-glow`.
- Inactive options use neutral `glass-control` with `--text-secondary`.

First setup helper:

- Uses `glass-card`.
- Lead text: `16px`, `font-semibold`, `--accent-warm`.
- Body text: `14px`, `leading-5`, `--text-secondary`.

Dev tools:

- Dev tools panel is rendered by the existing dev flags and keeps its own technical UI.

## Text Screen

Purpose:

- User generates a daily reading text, reads the active text, adds words to vocabulary and completes daily reading.
- The screen calls the existing service layer and does not access DB directly.

Layout:

- Uses the same full-bleed app background from `Layout`.
- Inner content width follows home/settings:
  - mobile: `max-w-[430px]`
  - `480px+`: `max-w-[390px]`
- Content spacing: `space-y-3`, `px-3.5`, `pt-3`.
- Header uses `ScreenHeader` with title `Текст`.

Idle generation state:

- Uses `ReadingGenerationCard`.
- Main card: `glass-card rounded-[20px] p-3`.
- Left icon: `BookOpen` in circular `glass-control`, `size-14`, `390px+` -> `size-16`.
- Heading text: `Сгенерируй текст для чтения и начни сегодняшний урок.`
- Reading chips show level, remaining attempts/daily limit and reading time.
- CTA uses shared `Button`, full-width, coral background, `Sparkles` icon, label `Сгенерировать текст`.
- Helper card `ReadingInfoCard` explains the daily text flow.
- If generation fails before a text exists, `InlineStatusCard` with `error` appears directly below the main generation card and above the helper card.

Generated text state:

- Uses compact `ReadingGeneratedToolbar` with chips and full-width CTA.
- CTA label is `Сгенерировать новый текст`.
- Text content uses `ReadingTextCard`:
  - `glass-card rounded-[20px] p-4`
  - title `18px`, `font-heading`, `font-semibold`
  - source badge is a glass pill with `AI · model` or `DB`
  - body text uses `17px`, `leading-7`, controlled paragraph spacing `space-y-3`
  - selectable words use primary hover/selected state
  - saved words use warm accent state
- The finish CTA `Завершить текст` is a full-width shared `Button` below the text card.

Status states:

- Loading states use `LoadingState`.
- Completed daily reading uses `InlineStatusCard` variant `success` with title `Текст на сегодня прочитан`.
- Error states use `InlineStatusCard` variant `error` with title `Не удалось сгенерировать текст`.
- If generation fails while an active text exists, the error card appears below the compact generated toolbar and above the text card.

Implementation:

- Screen container: `src/screens/ReadingScreen.tsx`.
- Reading UI components: `src/components/reading/*`.
- Text parsing and selectable word normalization: `src/utils/readingText.ts`.
- Preserve stable `wordIndex` for vocabulary save flow.

## Materials Card

Header: `Мои материалы`.

Grid:

- Always 2 columns on home.
- Both tiles have fixed height to avoid jumping during vocabulary state loading.

Tile structure:

```tsx
grid h-[108px] grid-rows-[44px_40px] content-start
rounded-[16px] p-2.5
```

Rules:

- `Тексты` and `Словарь` icons must align on the same baseline.
- Icon containers are fixed `size-10`.
- Text area is fixed `h-10`.
- Vocabulary status reserves two lines:
  - `Добавить: N`
  - `Подтвердить: M`
- Do not let loading/ready/pending vocabulary status change tile height.

## Bottom Navigation

Fixed to bottom of viewport:

```tsx
<div className="fixed inset-x-0 bottom-0 z-20 px-2 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-1.5">
```

Nav capsule:

```tsx
<nav className="
  mx-auto grid max-w-[430px] grid-cols-3
  rounded-[22px] border border-[var(--border)]
  bg-[var(--surface-strong)] p-1.5
  shadow-primary-glow backdrop-blur-[24px]
  min-[480px]:max-w-[390px]
">
```

Nav item:

- icon: `19px`.
- text: `9px`; на `390px+` используется `10px`.
- text must stay inside its button; use `truncate`.
- active item uses `bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow`.

## Toast

Position:

- fixed top overlay: `top-[calc(env(safe-area-inset-top)+20px)]`, centered.
- viewport wrapper uses `z-[100]`, `w-full`, `px-4`.
- toast width: `w-[calc(100%-32px)]`, `max-w-[390px]`.

Base:

- `AppToast` is the primary component API.
- supported variants: `success`, `warning`, `error`.
- root: floating pill-like glass card, `rounded-[28px]`, `border`, `backdrop-blur-[24px]`.
- current compact sizing: `min-h-[70px]`, `gap-3`, `px-3.5`, `py-3`.
- icon container: circular glass control, `size-14`; on `390px+` uses `size-16`.
- icon: `size-6`; on `390px+` uses `size-7`.
- close button: circular `size-9`, `aria-label="Закрыть уведомление"`.
- enter animation: `app-toast-enter 220ms ease-out`.
- `role="status"`, `aria-live="polite"`; error uses `aria-live="assertive"`.

Variants:

- `success`: blue in light theme (`#1F78E8`), cyan in dark theme (`#6BD8FF`), `Check` icon.
- `warning`: amber in light theme (`#F59E0B`), warm yellow in dark theme (`#FFD17A`), `TriangleAlert` icon.
- `error`: red in light theme (`#EF4444`), coral in dark theme (`#FF7A6E`), `XCircle` icon.

Compatibility wrapper:

- Existing `Toast` wrapper accepts current app tones: `default`, `onboarding`, `success`, `error`.
- `default` and `onboarding` map to `warning`.
- `success` maps to `success`; `error` maps to `error`.

## Accessibility

- Icon-only controls need `aria-label`.
- Keep focus ring:
  - `focus-visible:outline-none`
  - `focus-visible:ring-2`
  - `focus-visible:ring-[var(--primary)]`
  - `focus-visible:ring-offset-2`
  - `focus-visible:ring-offset-[var(--background)]`
- Do not rely only on color for progress state; keep icons and labels.

## Verification

After visual changes:

1. Run `pnpm lint`.
2. Run `pnpm build` when classes/layout changed. In this environment Vite/esbuild may require escalated permission because esbuild spawns a child process.
3. Restart `npm run dev:telegram` before checking in Telegram.
4. Check real mobile Telegram first.
5. Also check desktop Telegram preview, but do not optimize desktop at the expense of mobile.

## Current Design Notes

- The actual source of truth is current `src/screens/HomeScreen.tsx`, `src/screens/ReadingScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/components/Layout.tsx`, `src/components/BottomNav.tsx`, `src/components/Button.tsx`, `src/components/ScreenHeader.tsx`, `src/components/LoadingState.tsx`, `src/components/InlineStatusCard.tsx`, `src/components/ThemeToggle.tsx`, `src/components/Toast.tsx`, `src/components/reading/*`, and `src/index.css`.
- If this document conflicts with implementation, inspect implementation first and update this document after the design is approved.
- Keep future changes iterative; avoid large redesigns across all screens in one task.
