# Design System: english-daily-loop

Актуальная дизайн-система проекта для главной страницы и общих layout-компонентов.

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
- Settings and theme are icon-only controls with `aria-label`.
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
- chip grid uses `grid-cols-[1fr_5rem_1fr]`; the middle column matches the connector width between progress icons.
- on `390px+` chip grid uses `grid-cols-[1fr_6rem_1fr]`.
- outer chip edges align with the full horizontal divider; inner chip edges align with the connector edges.
- compact height: `py-1`.
- current reading time uses warm accent.
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

- The actual source of truth is current `src/screens/HomeScreen.tsx`, `src/components/Layout.tsx`, `src/components/BottomNav.tsx`, `src/components/Button.tsx`, `src/components/ThemeToggle.tsx`, and `src/index.css`.
- If this document conflicts with implementation, inspect implementation first and update this document after the design is approved.
- Keep future changes iterative; avoid large redesigns across all screens until home is stable.
