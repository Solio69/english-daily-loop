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
- Theme preference lives in `src/context/ThemeContext.tsx` as `system | light | dark`.
- Default preference is `system`: inside Telegram it follows `Telegram.WebApp.colorScheme`; outside Telegram it falls back to `prefers-color-scheme`.
- User preference is stored in `localStorage` under `english-daily-loop-theme-preference`.
- `index.html` applies an early theme bootstrap before React renders, so the first paint uses the effective theme and avoids a light-theme flash in dark Telegram.

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
- Bottom nav label: `8px`; на `390px+` используется `9px`.

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
  - right: three-segment theme control, settings icon button
- Second row:
  - user name on the left
  - subscription button on the right

Rules:

- Header controls must be the same height.
- Current header controls height: `h-9`; settings control is `size-9`.
- Theme control is a compact segmented `radiogroup` with three icon-only options:
  - `Как в Telegram`: paper-plane icon, follows Telegram/system theme
  - `Светлая тема`: sun icon
  - `Темная тема`: moon icon
- Subscription button shows full `Подписка`.
- Free subscription button label `Купить` uses `--accent-warm`; paid subscription state uses `--primary`.
- Subscription button icon: `15px`.
- Settings button is a circular warm icon control with `aria-label="Открыть настройки"`, `--accent-warm`, `--accent-warm-soft` and a subtle warm glow.
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
- review/vocabulary chip uses neutral glass for `not_started`, warm accent for
  `in_progress` and primary/cyan for `completed`.
- chip text shows the required word count when it is greater than zero; otherwise
  it shows `Слова`.

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
- The panel is collapsed by default; the header toggles local actions and shows the running state.
- Keep the dev tools surface compact and amber-toned so it reads as a local technical block, not a product feature.

## Text Screen

Purpose:

- User generates reading texts within the daily attempt limit, reads the active text, adds words to vocabulary and completes the active text.
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
- Helper card `ReadingInfoCard` explains the reading generation flow.
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
  - `В словаре: N`
- Do not let loading/ready/pending vocabulary status change tile height.

## Materials Screen

Purpose:

- Shows completed reading texts and vocabulary materials.
- Uses service layer only; no direct DB access from UI.

Layout:

- Uses the same full-bleed app background from `Layout`.
- Inner content width follows home/settings:
  - mobile: `max-w-[430px]`
  - `480px+`: `max-w-[390px]`
- Content spacing: `space-y-3`, `px-3.5`, `pt-3`.
- Header uses `ScreenHeader` with title `Мои материалы`.

Tabs:

- Two equal statistic-like glass tabs inside a `glass-card`.
- Default and first tab is `Словарь`; `Тексты` is second.
- Active tab uses `--primary`, `--primary-soft`, `--border-strong` and `shadow-primary-glow`.
- Inactive tab uses `--text-muted` / `--text-secondary`.
- Labels:
  - `Текстов: N`
  - `Слов: N`

Completed text cards:

- Card root: `glass-card rounded-[20px] p-4`.
- Date and completion time: `13px`, semibold, `--text-muted`.
- Title: `20px`, `font-heading`, semibold, `--text-primary`.
- Excerpt: `15px`, `leading-6`, `--text-secondary`.
- Level/model chips use `--surface-strong`.
- Reading time pill and `Показать полностью` use `--accent-warm`.
- Do not use green for materials accents.

Vocabulary tab:

- Summary and word cards use the same `glass-card` / `glass-control` primitives.
- Error state reuses `InlineStatusCard` with `variant="error"`.
- Summary header uses icon + title `Словарь`.
- If `totalCount === 0`, show the helper copy `Добавленные из текстов слова будут появляться здесь.` under the title.
- If `totalCount > 0`, show the compact `Добавить` status card under the summary header:
  - Keep cards compact; avoid tall dashboard tiles.
  - Card uses `Layers`.
  - Active pending state uses warm accent: `N добавить` + `слово/слова/слов без карточки/карточек`.
  - Zero pending state uses primary/cyan ready-state: `Все готовы` + `слов без карточек нет`.
  - Do not show a separate totals line with `Всего` / `В словаре` inside the summary card.
  - Do not show a separate all-prepared info row below the status card.
- Main pending action is a fixed-height warm split block: left side shows `TriangleAlert` with pending-word context and a highlighted attempts line `Осталось: remaining/dailyLimit попытка/попытки/попыток`; right side is a compact coral `Готовить` CTA with `Sparkles`; do not use arrows or chevrons because the action does not navigate.
- The attempts line is plain emphasized text without a separate outline/chip. Available attempts use warm accent; exhausted attempts use coral/error accent.
- When card preparation attempts are exhausted, keep the pending action visible, disable the CTA and show `Завтра` inside the button instead of a separate exhausted-warning block.
- During card preparation, keep the same button dimensions and replace `Sparkles` with an inline spinner icon.
- Preparation errors are shown directly below the pending action and above the compact info panel via `InlineStatusCard`.
- If there are pending words, show a compact inline info panel below the action in the style of `ReadingInfoCard`.
- Approval UI is hidden behind the TODO feature flag `SHOW_VOCABULARY_CARD_APPROVAL_FLOW` until the card editing/review flow is implemented.
- Edit action UI is hidden behind the TODO feature flag `SHOW_VOCABULARY_CARD_EDIT_ACTION` until the card editing flow is implemented.
- Expanded word cards are split into summary/details/examples/actions components.
- Expanded details show part of speech and verb forms; status is not duplicated inside the expanded body.
- Examples highlight matching word/forms with `--primary`.
- Expanded cards scroll into view when opened so the card stays visible above bottom navigation.
- Ready/confirmed states use `--primary`, not green.
- Closed ready rows keep word + translation on the left and the trailing chevron on the right.
- An `active` ready word replaces the generic status chip with a compact warm
  `reviewStep` chip and a muted `lastReviewedAt → nextReviewDate` line below it.
- Review dates use the short Russian format (`23 июн.`) and the `Europe/Moscow`
  calendar date. `not_started`, `learned` and incomplete review data keep their
  regular status chip.

## Vocabulary Review Screen

Purpose:

- Runs the daily review queue from the bottom navigation item `Слова`.
- Shows one card at a time and keeps dictionary preparation as a separate
  navigation action.

Layout:

- Uses `ScreenHeader` with title `Слова`.
- Inner content follows the compact mobile width: `max-w-[430px]`, and
  `max-w-[390px]` on `480px+`.
- Main vertical rhythm: `space-y-3`, `px-3.5`, `pt-3`.
- Expanded cards scroll into view above the fixed bottom navigation.

Progress card:

- Root: `glass-card rounded-[20px]`, warm border and `shadow-warm-glow`.
- Header uses a fixed circular `Flame` control, warm title `Повторение` and the
  exact required count for the day.
- Progress bar and `reviewed / total` counter use warm accent.
- Bottom summary has two equal columns: `Всего` with `Target` and `Осталось`
  with `Flame`.

Dictionary actions notice:

- Render only when pending cards exist.
- Keep it separate from the review word card.
- Use `BookMarked` without a bordered icon container.
- Title and trailing `ChevronRight` use warm accent.
- Copy: `Открой словарь, чтобы добавить новые слова в повторение`.
- Bottom line shows compact `N подготовить` action.

Closed review card:

- Root: `glass-card rounded-[20px] p-4`.
- Word is left-aligned, `32px`, bold; do not render a part-of-speech chip.
- Supporting copy: `Открой перевод и выбери следующий интервал.`
- Three fixed controls show `перевод`, `формы`, `примеры`; use `Eye` for
  translation and `LockKeyhole` for locked sections.
- Full-width `Показать перевод` uses the shared coral primary button.

Expanded review card:

- Reuses `VocabularyWordDetails` and `VocabularyWordExamples`; do not create a
  second visual language for dictionary content.
- Header shows word, translation and compact status `Не изучено` or
  `В повторении`.
- Verb forms use the blue/cyan `Box` icon shared with dictionary cards.
- Target word/forms in examples use warm highlight; dictionary cards keep the
  primary highlight.
- No audio icon is shown until pronunciation playback exists.
- Four interval actions form one stable `grid-cols-4` row.
- Interval actions use primary blue in light theme and warm accent in dark theme;
  all four buttons share the same style, including `Не помню`.

Empty and completed states:

- With no ready cards, show a compact centered `BookText` state and direct the
  user to add/confirm words in materials.
- Completed state uses primary/cyan `CheckCircle2`, title `Повторение готово`
  and copy `План на сегодня завершен.`
- `Проверить новые слова` is a secondary glass action and must not reopen the
  required daily progress.

## Bottom Navigation

Fixed to bottom of viewport:

```tsx
<div className="fixed inset-x-0 bottom-0 z-20 px-2 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-1.5">
```

Nav capsule:

```tsx
<nav className="
  mx-auto grid max-w-[430px] grid-cols-4
  rounded-[22px] border border-[var(--border)]
  bg-[var(--surface-strong)] p-1.5
  shadow-primary-glow backdrop-blur-[24px]
  min-[480px]:max-w-[390px]
">
```

Nav item:

- icon: `19px`.
- text: `8px`; на `390px+` используется `9px`.
- text must stay inside its button; use `truncate`.
- active item uses `bg-[var(--primary-soft)] text-[var(--primary)] shadow-primary-glow`.
- Items: `Главная` (`Home`), `Текст` (`BookOpen`), `Слова` (`BookText`), `Материалы` (`LibraryBig`).

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

- The actual source of truth is current `src/screens/HomeScreen.tsx`, `src/screens/ReadingScreen.tsx`, `src/screens/VocabularyScreen.tsx`, `src/screens/MaterialsScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/components/Layout.tsx`, `src/components/BottomNav.tsx`, `src/components/Button.tsx`, `src/components/ScreenHeader.tsx`, `src/components/LoadingState.tsx`, `src/components/InlineStatusCard.tsx`, `src/components/ThemeToggle.tsx`, `src/components/Toast.tsx`, `src/components/reading/*`, `src/components/vocabulary/*`, `src/components/vocabulary-review/*`, and `src/index.css`.
- If this document conflicts with implementation, inspect implementation first and update this document after the design is approved.
- Keep future changes iterative; avoid large redesigns across all screens in one task.
