# ADR: "Coffre Nocturne" — a dark-first redesign of the web front

> Date: 2026-11-03
> Status: ✅ Active

## Context

The front had grown screen by screen: a long single-column dashboard whose hero showed one figure, a donut split by account rather than by asset class, heavy 40px period buttons in half-width cards, three different shades of green and red for gains and losses, card radii from 10px to 26px, a sidebar of 72px rows with descriptions, and a mobile bar of seven unlabelled icons. Meanwhile the backend already served much more than the front showed (pyramid and score, sector and country diversification, projections, cash-flow Sankey, dividend forecast, amortisation schedules, property valuations, realised P&L).

The owner asked for a modern wealth dashboard with more statistics, inspired by how leading wealth trackers organise information, mocked up first (Claude Design: design system "Picsou" and canvas "Picsou — Refonte"), then built.

## Decision

1. **Dark first.** A near-black graphite theme ("Coffre Nocturne") is the default for new installs (`DEFAULT_THEME = 'dark'` in `lib/theme.ts` and `public/theme-init.js`); the light theme keeps the same roles. Existing users keep their stored choice.
2. **Semantic movement and class tokens.** `--gain`, `--loss`, `--warning`, `--class-*` and `--on-class` join the theme, exposed as Tailwind colours; every raw `emerald`/`red`/`amber` class in the app was replaced by them. Asset classes get one fixed colour each, in an order validated against colour blindness; `--chart-1..5` becomes a blue ramp; `--slice-*` starts with the class colours.
3. **A new shell.** Compact sidebar (40px rows, eight destinations), a top bar (search, Me/Household, sync status, privacy eye, Sync), a five-entry mobile bar with "More", and a search palette on ⌘K / Ctrl K.
4. **New pages from served data only.** `/investments`, `/income` and `/real-estate` join the dashboard, accounts, budget, goals and analysis pages, all rebuilt from existing endpoints. Figures that need new backend computations (TWR, XIRR, volatility, fund fees, benchmark comparison, age-group medians) are left out rather than faked; front-side aggregations (asset classes, liquidity, passive income, savings rate, financial-independence simulation) are pure functions with tests.
5. **Compact card controls.** A 32px `SegmentedControl` is the standard switch inside card headers; page-level controls keep the 40px rhythm. Cards use `rounded-2xl` (primitive changed app-wide).

## Alternatives considered

### Keep the light "Coffre Lumineux" identity and only reorganise the pages

- **Pros**: no theme work, DESIGN.md unchanged.
- **Cons**: the owner chose a new dark look when shown both options; the colour inconsistencies would remain.

### Build the new statistics in the backend at the same time

- **Pros**: the mockup complete in one go (performance metrics, fees, benchmark).
- **Cons**: a very large PR mixing a visual redesign with financial calculations that each deserve their own review; chosen as a second lot instead.

### Remove the classic sidebar style

- **Pros**: one sidebar to maintain.
- **Cons**: removes a user setting nobody asked to drop; the two styles now differ only in where Settings and the profile row sit, so keeping both costs little.

## Reasoning

The redesign is a front concern: every block shown is backed by data the backend already returns, so it can ship and be reviewed on its own. Semantic tokens fix the colour drift at the root and make the dark theme a palette swap rather than per-component overrides. Hiding unsupported figures keeps the "no hollow numbers" principle of PRODUCT.md.

## Trade-offs accepted

- New installs open in dark mode even if the OS is light; a user who wants the OS to decide picks "System" in Settings.
- Yellow and orange freshness levels collapse into the single `warning` token.
- Some figures of the mockup wait for the backend lot (performance metrics, fees, benchmark, staking income, INSEE median).

## Consequences

- `DESIGN.md` rewritten; `docs/conventions/frontend.md` documents the tokens, the compact control and the breakdown component.
- New shared components: `KpiTile`, `Delta`, `SegmentedControl`, `Breakdown`, `Kbd`, `CommandPalette`, `AppTopBar`; `BreakdownChart` moved from the analysis page to `components/shared`.
- `theme-contrast.test.ts` now checks text, movement and class tokens in both themes.
