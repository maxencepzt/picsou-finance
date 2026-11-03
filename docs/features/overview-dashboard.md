# Feature: Overview dashboard (Synthèse)

> Last updated: 2026-11-03

## Context

The home page answers "where do I stand?" in one glance (PRODUCT.md, "situation, not report"). Since the "Coffre Nocturne" redesign it shows a headline figure, six indicators, the evolution and the breakdown side by side, then liquidity, what is coming, what needs attention, goals and the wealth score. Every figure comes from data the backend already serves; the details live on the dedicated pages (positions on Investments, loans and property on Property & loans).

## How it works

`frontend/src/pages/dashboard/DashboardPage.tsx`, top to bottom:

1. **Hero**: net / gross / financial worth (dropdown), the change of that curve over the selected range (`Delta`, first vs last point of the history the chart shows), "assets minus debts", and the portfolio performance (`usePnl` on accounts with holdings; an unknown range P&L shows "—", never 0).
2. **KPI row** (`KpiTile` ×6): gross assets (account count), debts (monthly loan payments), change over one month (`useHistory(all accounts, 1)`), passive income over 12 months (`usePassiveIncome`), savings rate of the current budget cycle (`useCashflow('CYCLE')`: net ÷ income), available cash (current and savings accounts).
3. **Evolution** (`NetWorthChart`, range selector) and **Breakdown** (`AllocationCard`): by asset class (default) or by account, drawn as stacked bar, donut or treemap (`Breakdown`).
4. **Liquidity** (`LiquidityCard`): available / market / locked (PEA, life insurance, pension) / illiquid (property, SCPI), from `lib/asset-classes.ts`.
5. **Next 30 days** (`UpcomingCard`): dividend and SCPI forecast, recurring debits and credits, card statements, sorted by date.
6. **To do** (`AttentionCard`): failed bank connections, overspent envelopes, transactions to categorise, stale prices — each a link.
7. **Goals** (`GoalsCard`: the three savings goals closest to done) and **Wealth health** (`HealthCard`: pyramid score, misplaced share, loan-to-value, safety net).

The sync banner and the Sync button moved to the top bar (see `sidebar-navigation.md`).

### Key files

- `frontend/src/pages/dashboard/*.tsx` — page and cards
- `frontend/src/lib/asset-classes.ts` — account type → asset class → liquidity, `sumBy`
- `frontend/src/features/income/` — passive-income aggregation (`usePassiveIncome`, `incomeSchedule`)
- `frontend/src/components/shared/{KpiTile,Delta,Breakdown,SegmentedControl}.tsx`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Group the breakdown by asset class on the client | `distribution` already carries each account's type | A new endpoint |
| Passive income summed on the client | Dividend/SCPI forecast, rent and passbook projections are served separately | Backend aggregation (later lot) |
| Leave out "movers of the day" and the age-group median | They need daily per-line changes and a reference table the backend does not have | Placeholder figures |

## Gotchas / Pitfalls

- `assetClassOf` must not use `??` on the mapping: liabilities map to `null` on purpose.
- Passbook interest is booked in full on its capitalisation date, not spread over the year.
- The range change uses the intraday series on 24H.

## Tests

- `DashboardPage.test.tsx` — the portfolio performance line (unknown vs zero).
- `lib/asset-classes.test.ts`, `features/income/passive-income.test.ts`.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `dashboard-time-range-isolation.md`, `wealth-pyramid.md`, `dividend-forecast.md`, `savings-livrets.md`
