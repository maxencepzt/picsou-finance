# Feature: Investments page (Investissements)

> Last updated: 2026-11-03

## Context

The positions used to be scattered across account pages and the Analysis section. `/investments` gathers every line held in an investment wrapper on one page: what it is worth, how it moved, how concentrated it is, what was realised this year, how it performed against an index, what it costs in fees, and how far each PEA and assurance vie is from its tax advantage.

## How it works

`frontend/src/pages/investments/InvestmentsPage.tsx`, top to bottom:

1. **Hero**: portfolio value, unrealised gain (`Delta`, percent over the lines whose cost is known), then capital invested, realised this calendar year, dividends received over 12 months (`useReceivedDividends(365)`, summed from `ReceivedDividend.amountEur`; a credit without a rate is left out and the footer says how many) and the line count with the number of wrappers.
2. **Evolution** (`NetWorthChart` over the investment accounts, own range selector) beside **Concentration** (`ConcentrationCard`): share of the three largest lines, the largest one, and the split by listing currency.
3. **Performance** (`PerformanceCard`, `usePerformance(months)`, see `investment-performance.md`) beside **Fees** (`FeesCard`, `useFees(12)`):
   - Performance: a period `SegmentedControl` (3M · 6M · 1A · 3A · 5A · Tout → 3, 6, 12, 36, 60, 0 months), five tiles — TWR, annualised, XIRR, volatility, worst fall with its peak and trough dates — and one plain line telling TWR from XIRR. A null metric shows "—" with the reason as its caption (and `aria-label`), never 0. Under it, `PerformanceChart` draws the TWR index at base 100 with a "compare with" switch (none · MSCI World · S&P 500 · CAC 40, `useBenchmark(key, months)`): the benchmark closes are rebased to 100 on the first date both series share, on one axis, with a legend, a tooltip giving both values and the gap in points, and a one-line result for the period.
   - Fees: weighted TER and the yearly cost it implies, the share of the value whose TER is known, the five lines that cost the most a year (value × TER) with the rest summed up, and broker fees paid over 12 months with how many transactions carried one.
4. **Positions** (`PositionsCard`): every line, sortable (`useTableSort`), filterable by wrapper (PEA / CTO / crypto / other) with a `SegmentedControl`; weight is computed over the lines shown. A click on a non-cash line opens `HoldingDetailModal`.
5. **Diversification**: `pages/analysis/DiversificationSection.tsx`, moved here from `/analysis` (see `portfolio-diversification.md`).
6. **Realised gains** (`RealizedGainsCard`, one year at a time) and **Tax wrappers** (`TaxWrappersCard`), each shown only when it has something to say.

Lines are `usePortfolio()` filtered to `HOLDING_ACCOUNT_TYPES` (`investmentLines`), which drops the aggregated bank-cash row. Realised P&L is fetched per account with `useRealizedPnls(accountIds)` (`features/investments/hooks.ts`), which reuses the query keys of `useRealizedPnl` so both share one cache and its invalidations.

### Key files

- `frontend/src/pages/investments/InvestmentsPage.tsx` — page and hero
- `frontend/src/pages/investments/investments.ts` — `investmentLines`, `portfolioTotals`, `concentration`, `currencySplit`, `eurRate`, `realizedYears`, `realizedInYear`, `maturity`, `TAX_WRAPPER_YEARS`
- `frontend/src/pages/investments/performance.ts` — `PERF_PERIODS`, `BENCHMARKS`, `compareToBenchmark`, `costliestLines`, `feeCoverage`, `dateTicks`, `dateTickFormat`
- `frontend/src/pages/investments/{PositionsCard,ConcentrationCard,PerformanceCard,PerformanceChart,FeesCard,RealizedGainsCard,TaxWrappersCard}.tsx`
- `frontend/src/features/analysis/hooks.ts` — `usePerformance`, `useBenchmark`, `useFees`
- `frontend/src/features/investments/hooks.ts` — `useRealizedPnls`
- `frontend/src/features/dividends/hooks.ts` — `useReceivedDividends`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Realised amounts converted with the account's balance ratio (`eurRate` = `currentBalanceEur ÷ currentBalance`) | The API sends realised lots in the account currency; the ratio is today's rate, already on the page | A client FX lookup; leaving foreign accounts out |
| Dividends summed from `amountEur`; a credit without one is skipped and counted | The API converts each credit; counting a foreign credit at par would overstate or understate it silently | The balance-ratio shortcut it replaced |
| Benchmark and portfolio aligned on shared dates and rebased there | The index fund has no weekend or holiday closes, and history can start after the window: both must start at 100 on the same day for the gap to mean anything | Forward-filling the benchmark; rebasing each series on its own first day |
| Benchmark on the performance card, not on the evolution chart | The evolution chart plots euros including deposits; a fund's price only compares with the time-weighted index, and `NetWorthChart` is shared with the dashboard | An overlay on `NetWorthChart` |
| Performance tiles built locally instead of `KpiTile` | `KpiTile` truncates its caption, and here the caption is the reason a metric is missing; it must wrap at 360 px | `KpiTile` with a hover-only reason |
| Explicit month ticks on the comparison chart (`dateTicks`) | Fed daily points, Recharts ticks on the data and prints the same month twice | `minTickGap`, which still repeats months on a 6-month span |
| Currency split on `PortfolioLine.listingCurrency` | The live-price overlay replaces `quoteCurrency` with `EUR` once it prices a line in euros; `listingCurrency` keeps the currency the security is listed in | Reading `quoteCurrency` (every live-priced line would read EUR) |
| Concentration merges one ticker across wrappers | The same ETF in a PEA and a CTO is one exposure; cash rows stay apart | Counting each line separately |
| PEA / assurance vie maturity from `openedAt` (5 and 8 years) | The opening date is already stored for these wrappers (`accounts-overview.md`, Opening date); without it the card links to `/accounts`, where the account form edits it | Guessing from `createdAt` |
| No PEA 150 k€ deposit ceiling | Picsou stores no deposit history, and the value is not the deposits | A gauge over the current value |
| Realised gains drawn with the shared `Breakdown` (bar / donut / treemap), losses listed beside it | A part-to-whole can only draw positive amounts | One chart with negative slices |

## Gotchas / Pitfalls

- `eurRate` is marked `shortcut:` in code: an emptied non-EUR account has no balance to read a rate from and counts at par. Upgrade when the API sends realised amounts in EUR.
- The comparison chart's Y axis is an index, not an amount: `PerformanceChart.tsx` is listed in `money-guard.test.ts`'s `percentCharts`, so its axis does not go through `money.tick`.
- A benchmark with no prices yet (the price jobs fill it, see `investment-performance.md`) or fewer than two dates shared with the portfolio draws the portfolio alone with a quiet note; only a failed request shows an error.
- Demo mode answers an unhandled endpoint with `{}`, so `realized.data[i]?.lots` is guarded before use.
- The realised-year selector stays unset until the reader picks a year, so data arriving late still lands on the current year (or the latest year with a sale).
- The unit price in the positions table is `valueEur ÷ quantity`: a portfolio line carries no quote.

## Tests

- `pages/investments/investments.test.ts` — wrapper filter, totals, concentration across wrappers, currency split, realised years and nets in euros, balance-ratio rate, dividends in euros with the skipped count, maturity (months, cap, anniversary day, missing date).
- `pages/investments/performance.test.ts` — rebasing on the first shared date and dropping unshared ones, the lone index, fee ranking with the rest, coverage, month ticks and their format.
- `pages/investments/InvestmentsPage.test.tsx` — the page without the bank cash, realised gains, the missing PEA date, dividends with a skipped credit, the performance tiles with a dash and its reason, and the fees card.
- E2E `analysis.spec.ts` — the diversification breakdowns, now on `/investments`.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `investment-performance.md`, `portfolio-diversification.md`, `realized-pnl.md`, `live-prices-holdings.md`, `dividend-forecast.md`
