# Feature: Investments page (Investissements)

> Last updated: 2026-11-03

## Context

The positions used to be scattered across account pages and the Analysis section. `/investments` gathers every line held in an investment wrapper on one page: what it is worth, how it moved, how concentrated it is, what was realised this year and how far each PEA and assurance vie is from its tax advantage. Everything comes from endpoints the backend already serves.

## How it works

`frontend/src/pages/investments/InvestmentsPage.tsx`, top to bottom:

1. **Hero**: portfolio value, unrealised gain (`Delta`, percent over the lines whose cost is known), then capital invested, realised this calendar year, dividends received over 12 months (`useReceivedDividends(365)`) and the line count with the number of wrappers.
2. **Evolution** (`NetWorthChart` over the investment accounts, own range selector) beside **Concentration** (`ConcentrationCard`): share of the three largest lines, the largest one, and the split by listing currency.
3. **Positions** (`PositionsCard`): every line, sortable (`useTableSort`), filterable by wrapper (PEA / CTO / crypto / other) with a `SegmentedControl`; weight is computed over the lines shown. A click on a non-cash line opens `HoldingDetailModal`.
4. **Diversification**: `pages/analysis/DiversificationSection.tsx`, moved here from `/analysis` (see `portfolio-diversification.md`).
5. **Realised gains** (`RealizedGainsCard`, one year at a time) and **Tax wrappers** (`TaxWrappersCard`), each shown only when it has something to say.

Lines are `usePortfolio()` filtered to `HOLDING_ACCOUNT_TYPES` (`investmentLines`), which drops the aggregated bank-cash row. Realised P&L is fetched per account with `useRealizedPnls(accountIds)` (`features/investments/hooks.ts`), which reuses the query keys of `useRealizedPnl` so both share one cache and its invalidations.

### Key files

- `frontend/src/pages/investments/InvestmentsPage.tsx` — page and hero
- `frontend/src/pages/investments/investments.ts` — `investmentLines`, `portfolioTotals`, `concentration`, `currencySplit`, `eurRate`, `realizedYears`, `realizedInYear`, `maturity`, `TAX_WRAPPER_YEARS`
- `frontend/src/pages/investments/{PositionsCard,ConcentrationCard,RealizedGainsCard,TaxWrappersCard}.tsx`
- `frontend/src/features/investments/hooks.ts` — `useRealizedPnls`
- `frontend/src/features/dividends/hooks.ts` — `useReceivedDividends`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Realised amounts and non-EUR dividends converted with the account's balance ratio (`eurRate` = `currentBalanceEur ÷ currentBalance`) | The API sends realised lots and received dividends in the account currency; the ratio is today's rate, already on the page | A client FX lookup; leaving foreign accounts out |
| Currency split on `PortfolioLine.listingCurrency` | The live-price overlay replaces `quoteCurrency` with `EUR` once it prices a line in euros; `listingCurrency` keeps the currency the security is listed in | Reading `quoteCurrency` (every live-priced line would read EUR) |
| Concentration merges one ticker across wrappers | The same ETF in a PEA and a CTO is one exposure; cash rows stay apart | Counting each line separately |
| PEA / assurance vie maturity from `openedAt` (5 and 8 years) | The opening date is already stored for these wrappers (`accounts-overview.md`, Opening date); without it the card links to `/accounts`, where the account form edits it | Guessing from `createdAt` |
| No PEA 150 k€ deposit ceiling | Picsou stores no deposit history, and the value is not the deposits | A gauge over the current value |
| Realised gains drawn with the shared `Breakdown` (bar / donut / treemap), losses listed beside it | A part-to-whole can only draw positive amounts | One chart with negative slices |

## Gotchas / Pitfalls

- `eurRate` and the dividend conversion are marked `shortcut:` in code: an emptied non-EUR account has no balance to read a rate from and counts at par, and a non-EUR dividend is assumed to be in its account's currency. Upgrade when the API sends EUR amounts.
- Demo mode answers an unhandled endpoint with `{}`, so `realized.data[i]?.lots` is guarded before use.
- The realised-year selector stays unset until the reader picks a year, so data arriving late still lands on the current year (or the latest year with a sale).
- The unit price in the positions table is `valueEur ÷ quantity`: a portfolio line carries no quote.

## Tests

- `pages/investments/investments.test.ts` — wrapper filter, totals, concentration across wrappers, currency split, realised years and nets in euros, balance-ratio rate, maturity (months, cap, anniversary day, missing date).
- `pages/investments/InvestmentsPage.test.tsx` — the page without the bank cash, realised gains, and the missing PEA date.
- E2E `analysis.spec.ts` — the diversification breakdowns, now on `/investments`.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `portfolio-diversification.md`, `realized-pnl.md`, `live-prices-holdings.md`, `dividend-forecast.md`
