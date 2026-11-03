# Feature: Overview dashboard (Synthèse)

> Last updated: 2026-11-03

## Context

The home page answers "where do I stand?" in one glance (PRODUCT.md, "situation, not report"). Since the "Coffre Nocturne" redesign it shows a headline figure, six indicators, the evolution and the breakdown side by side, then liquidity, what is coming, what needs attention, the day's biggest moves, a comparison with households of the same age, goals and the wealth score. Every figure comes from data the backend serves; the details live on the dedicated pages (positions on Investments, loans and property on Property & loans).

## How it works

`frontend/src/pages/dashboard/DashboardPage.tsx`, top to bottom:

1. **Hero**: net / gross / financial worth (dropdown), the change of that curve over the selected range (`Delta`, first vs last point of the history the chart shows), "assets minus debts", and the portfolio performance (`usePnl` on accounts with holdings; an unknown range P&L shows "—", never 0).
2. **KPI row** (`KpiTile` ×6): gross assets (account count), debts (monthly loan payments), change over one month (`useHistory(all accounts, 1)`), passive income over 12 months (`usePassiveIncome`), savings rate of the current budget cycle (`useCashflow('CYCLE')`: net ÷ income), available cash (current and savings accounts).
3. **Evolution** (`NetWorthChart`, range selector) and **Breakdown** (`AllocationCard`): by asset class (default) or by account, drawn as stacked bar, donut or treemap (`Breakdown`).
4. **Liquidity** (`LiquidityCard`): available / market / locked (PEA, life insurance, pension) / illiquid (property, SCPI), from `lib/asset-classes.ts`.
5. **Next 30 days** (`UpcomingCard`): dividend and SCPI forecast, recurring debits and credits, card statements, sorted by date.
6. **To do** (`AttentionCard`): failed bank connections, overspent envelopes, transactions to categorise, stale prices — each a link.
7. **Biggest movers** (`MoversCard`, `useMovers(5)` → `GET /dashboard/movers`, see `dashboard-movers.md`): gainers or losers (a `SegmentedControl`, opening on the side that has rows), each with its logo (`HoldingLogo`, name monogram as fallback), the day's change (`Delta`) and the move on the position in euros; the subtitle reads "<date> vs <previousDate>". Nothing with two price days gives a quiet line, not a zero.
8. **You and households your age** (`PeersCard`): the gross assets of the hero (sum of `distribution`, the current Me/Household view) against the INSEE median gross wealth of households by age of the reference person, early 2024 (`pages/dashboard/peers.ts`: Insee Focus n° 371, figure 3a, survey Histoire de vie et Patrimoine 2023-2024). The age is `MemberProfile.age` (derived server-side from the birth date); `ageBracket` maps it to the INSEE bracket, and without a birth date the card uses the "all households" median and links to `/settings` to fill the profile. It shows a ratio ("3.2 × the median") and a signed gap in ink, a caveat that a household median is set against this view's gross worth, and the source link.
9. **Goals** (`GoalsCard`: the three savings goals closest to done) and **Wealth health** (`HealthCard`: pyramid score, misplaced share, loan-to-value, safety net).

The sync banner and the Sync button moved to the top bar (see `sidebar-navigation.md`).

### Key files

- `frontend/src/pages/dashboard/*.tsx` — page and cards
- `frontend/src/lib/asset-classes.ts` — account type → asset class → liquidity, `sumBy`
- `frontend/src/pages/dashboard/peers.ts` — INSEE median gross wealth by age bracket, `ageBracket`
- `frontend/src/features/dashboard/{api,hooks}.ts` — `getMovers`, `useMovers`
- `frontend/src/features/income/` — passive-income aggregation (`usePassiveIncome`, `incomeSchedule`)
- `frontend/src/components/shared/{KpiTile,Delta,Breakdown,SegmentedControl}.tsx`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Group the breakdown by asset class on the client | `distribution` already carries each account's type | A new endpoint |
| Passive income summed on the client | Dividend/SCPI forecast, rent and passbook projections are served separately | Backend aggregation (later lot) |
| Movers from `GET /dashboard/movers` | Day-over-day changes need two stored price days per line, which only the backend has | Computing moves on the client from holdings |
| INSEE medians as a static front table with its source | One published table, no backend state; the card cites it | A backend reference table |
| Peers as a ratio and a gap, no percentile | The source gives medians only; a percentile would be invented | "Top x %" from an interpolated distribution |
| The gap in ink, not gain/loss colours | Being below a median is not a movement; colours are kept for changes | `Delta` with green/red |

## Gotchas / Pitfalls

- `assetClassOf` must not use `??` on the mapping: liabilities map to `null` on purpose.
- Passbook interest is booked in full on its capitalisation date, not spread over the year.
- The range change uses the intraday series on 24H.
- The peers ratio is masked in privacy mode like the amounts: the median is public, so the ratio would give the worth away.
- The peers comparison is indicative: INSEE measures a whole household's gross wealth, the card uses the gross assets of the current view (Me or Household), and the median is from early 2024.

## Tests

- `DashboardPage.test.tsx` — the portfolio performance line (unknown vs zero).
- `peers.test.ts` — age brackets and their bounds, the "all households" fallback, the INSEE figures.
- `PeersCard.test.tsx` — ratio and gap for a 35-year-old; fallback median, profile link and source link without a birth date.
- `lib/asset-classes.test.ts`, `features/income/passive-income.test.ts`.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `dashboard-time-range-isolation.md`, `dashboard-movers.md`, `wealth-pyramid.md`, `dividend-forecast.md`, `savings-livrets.md`
