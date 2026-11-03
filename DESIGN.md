---
name: Picsou
description: Self-hosted personal-finance dashboard — credible, calm, private. Dark first.
colors:
  bg-dark: "#0a0c10"
  bg-light: "#f6f7f9"
  sidebar-dark: "#0d1015"
  sidebar-light: "#ffffff"
  surface-dark: "#12151b"
  surface-light: "#ffffff"
  surface-raised-dark: "#1a1e26"
  surface-raised-light: "#f1f3f6"
  ink-dark: "#f4f6f8"
  ink-light: "#0e1116"
  slate-dark: "#9ba3af"
  slate-light: "#5a6372"
  coffre-blue-dark: "oklch(0.707 0.165 254.624)"
  coffre-blue-light: "oklch(0.488 0.243 264.376)"
  on-coffre-blue-dark: "oklch(0.19 0.06 267.935)"
  gain-dark: "#4ade98"
  gain-light: "#06663b"
  loss-dark: "#f47a5b"
  loss-light: "#b43c0a"
  warning-dark: "#f2b544"
  warning-light: "#9a5b00"
  class-cash: "#3987e5 / #2a78d6"
  class-savings: "#d95926 / #eb6834"
  class-equity: "#199e70 / #1baf7a"
  class-crypto: "#c98500 / #eda100"
  class-funds: "#d55181 / #e87ba4"
  class-scpi: "#9085e9 / #6250d6"
  class-realestate: "#e66767 / #e34948"
  class-other: "#6b7280 / #9ca3af"
typography:
  family: "'Geist Variable', sans-serif"
  display: { size: "44px", weight: 700, lineHeight: 1.05 }
  headline: { size: "24px", weight: 700, lineHeight: 1.2 }
  kpi: { size: "22px", weight: 600, lineHeight: 1.2 }
  card-title: { size: "14px", weight: 700 }
  body: { size: "14px", weight: 400, lineHeight: 1.6 }
  label: { size: "13px", weight: 500 }
  caption: { size: "12px", weight: 500 }
rounded:
  control: "0.5rem (rounded-md)"
  tile: "0.75rem (rounded-xl)"
  card: "1.125rem (rounded-2xl)"
spacing:
  card-pad: "1rem"
  grid-gap: "1rem"
  compact-control-h: "2rem"
  control-h: "2.5rem"
  sidebar-w: "14.5rem"
  topbar-h: "3.5rem"
---

# Design System: Picsou — "Coffre Nocturne"

## 1. Overview

**Creative North Star: "Le Coffre Nocturne".** The strongbox seen at night, lit from within by the figures. The interface carries real money and treats it with the calm seriousness of a private ledger: a near-black graphite canvas, cards one tone lighter, and the numbers the user came to read in bright ink. Dark is the primary theme (the default for new installs); the light theme keeps exactly the same roles.

The organisation of the information takes inspiration from modern wealth dashboards: a headline figure, a row of indicators, an evolution chart, a breakdown, then the detail on demand. The identity stays Picsou's: no other product's name, logo, colours or screens.

The four traps named in PRODUCT.md still apply: no generic fintech flash (no violet gradients, no neon, no mascots), no cold analytics dashboard, no hollow marketing (no animated counters, no invented figures), no banking-app catalogue.

**Key characteristics:** dark first, one confident blue, movement colours that always come with a sign and an arrow, a fixed colour per asset class, flat cards with a hairline ring, one typeface, compact controls inside cards.

The design system is also published on Claude Design ("Picsou") with tokens, guidelines and live component previews; the mockup of every screen lives on the "Picsou — Refonte" canvas.

## 2. Colours

All colours are theme tokens in `frontend/src/index.css` (`:root` = light, `.dark` = dark), mirrored as Tailwind colours (`text-gain`, `bg-class-equity`…). `frontend/src/theme-contrast.test.ts` checks the pairs below in both themes.

### Surfaces and ink
- **Canvas** (`--background`): `#0a0c10` dark, `#f6f7f9` light. Nothing critical sits directly on it except the page title.
- **Card** (`--card`): `#12151b` / white — the only container. A 1px `ring-foreground/10` defines its edge.
- **Raised** (`--muted`, `--secondary`, `--accent`): `#1a1e26` / `#f1f3f6` — tiles inside a card, hovered rows, the track of a segmented control.
- **Ink** (`--foreground`): every amount, balance, percentage and title. ≥ 15:1 on every surface.
- **Slate** (`--muted-foreground`): labels, captions, axis ticks. ≥ 4.5:1 on every surface. Never on a critical figure.

### Coffre blue
`--primary` (`oklch(0.707 0.165 254.6)` dark, `oklch(0.488 0.243 264.4)` light) is the **only** saturated colour on interactive chrome: primary button, active navigation, selected segment, links, focus ring (`--ring`). ≤ 10 % of any screen. On a blue fill, the label is `--primary-foreground` (navy in dark). The selected tint is `bg-primary/12`.

### Movement
- **Gain** (`--gain`, `#4ade98` / `#06663b`) and **Loss** (`--loss`, `#f47a5b` / `#b43c0a`): positive and negative movement only — deltas, P&L, budget overspent. Always with a sign and an arrow (`Delta` component), so the direction never rests on colour alone. A falling debt is a gain.
- **Warning** (`--warning`): a stale price, a sync to check, an envelope at 80 %. Always with an icon and a word.
- **Destructive** stays for destructive actions and errors.

### Asset classes
One fixed colour per class, in the order validated against colour blindness (adjacent pairs ΔE ≥ 8 in both themes): cash, regulated savings, stocks & ETFs, crypto, funds (life insurance, pension), SCPI, property, other (neutral). **Colour follows the class, never its rank.** Mapping from account types: `frontend/src/lib/asset-classes.ts`. Labels drawn inside a class fill use `--on-class`. `--slice-1..10` (categorical charts) start with the same eight colours.

### Charts
`--chart-1..5` is a single-hue blue ramp: `chart-1` is the value line (with a faint `--chart-area-opacity` wash), `chart-5` the dashed "capital invested" reference. Ordered data (liquidity buckets, scenarios) take ramp steps by lightness. Gridlines are recessive; every multi-series chart has a legend; hover tooltips use the popover surface.

## 3. Typography

One family, **Geist Variable**; hierarchy from weight and size only. Numbers use tabular figures.
- **Display** (44px / 700): the single headline figure of a screen — the net worth.
- **Headline** (24px / 700): the page title (`PageHeader`).
- **KPI** (22px / 600): the figure of a `KpiTile`.
- **Card title** (14px / 700): small and bold, never enlarged.
- **Body** (14px), **label** (13px / 500), **caption** (12px / 500).

## 4. Layout and elevation

- **Shell:** a 232px sidebar (40px rows: icon + label, active row tinted blue), a 56px top bar (search, Me/Household, sync status, privacy eye, Sync button), content up to 1280px wide. On phones: a floating bottom bar with five labelled entries, the fifth ("More") opening the rest.
- **Grid:** cards in a 12-column rhythm with 16px gaps; a KPI row of six tiles on wide screens, two on phones.
- **Elevation:** flat by default — a hairline ring, never a shadow at rest. Shadows only on what floats: dialogs, the search palette, sheets, popovers.
- **Shape:** cards `rounded-2xl`, tiles and rows `rounded-xl`, controls `rounded-md`, badges and dots `rounded-full`.

## 5. Components

- **Card** — `Card` primitive: title, optional action (a link or a `SegmentedControl`), content.
- **KpiTile** — label, figure, one line under it (a `Delta` or a caption).
- **Delta** — signed amount and/or percentage with an arrow, gain/loss colour, `invert` for debts.
- **SegmentedControl** — the compact 32px switch of card headers (period, view, grouping). Page-level controls keep the 40px height.
- **Breakdown** — a part-to-whole drawn as stacked bar, donut or treemap (the user chooses), always with a legend listing names, amounts and shares.
- **TimeRangeSelector** — period switch of the value charts, built on `SegmentedControl`, scrolls on a phone.
- **Search palette** — opened from the top bar or with ⌘K (macOS) / Ctrl K (Windows, Linux): accounts, securities, pages, quick actions. The shortcut shown always matches the platform.
- **Kbd** — a keycap.
- Range inputs use the `range-input` class (blue fill, light thumb).

## 6. Motion

Feedback where it carries meaning (a press, a sync), silent elsewhere. `prefers-reduced-motion` is enforced globally in `index.css`.

## 7. Do's and Don'ts

### Do
- Render every amount through `CurrencyDisplay` / `useMoney` (privacy mode) in ink, with tabular figures.
- Pair every gain or loss colour with a sign and an arrow.
- Give each asset class its fixed colour, everywhere.
- Offer bar / donut / treemap for a breakdown, and keep the legend.
- Show the keyboard shortcut of the user's platform (⌘ or Ctrl), never a hard-coded one.
- Leave out a figure the data cannot support rather than inventing one.

### Don't
- Use raw palette classes (`text-emerald-500`, `bg-red-50`…): only tokens.
- Use violet gradients, neon, glows, gradient text, colored left-border cards or emoji.
- Shadow a card at rest.
- Enlarge card titles, or add a second typeface.
- Put slate on a critical figure.
- Copy another product's identity.
