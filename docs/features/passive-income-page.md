# Feature: Passive income page (Revenus passifs)

> Last updated: 2026-11-03

## Context

Dividends, SCPI distributions, rent and passbook interest were each visible somewhere (budget card, account pages, property summary, savings projection), never together. `/income` answers "what will my money pay me over the next twelve months, when, and from whom", from what the backend already projects.

## How it works

`usePassiveIncome()` (`features/income/hooks.ts`) gathers three sources the backend serves separately:

- the dividend and SCPI forecast, `useUpcomingDividends(366)`;
- the monthly rent of the properties, `useRealEstateSummary().monthlyRentalIncome`;
- the yearly interest projection of each account with a `savingsConfig` (`savingsApi.getInterest`, one query per passbook).

`incomeSchedule(from, dividends, monthlyRent, savings)` (`features/income/passive-income.ts`) builds twelve `YYYY-MM` buckets from the current month: dividends and SCPI on their payment date (else the expected date), rent every month, a passbook's whole year of interest in the month of its `nextCapitalizationDate`. `incomeTotals` sums them per source. Any failed source fails the whole page: a silently missing source would understate the total.

`pages/income/IncomePage.tsx`, top to bottom:

1. **Hero**: projected total over twelve months, per month, dividends received over the last year (`useReceivedDividends(365)`, `GET /dividends/received`), a stacked bar by source, and coverage of essential expenses (monthly income ÷ `monthlyEssentialExpenses` from the allocation targets; a link to `/analysis` when the expenses are not stated).
2. **Months** (`IncomeMonthsChart`): the twelve months stacked by source; only paying sources get a bar and a legend entry.
3. **Next payments**: the next eight dividends, distributions and capitalisations, soonest first (`nextPayments`).
4. **By payer**: one row per payer inside the schedule's window, largest first (`incomeBySource`): dividend payers and SCPI grouped by name, one row per passbook, one for rent. The rows add up to the schedule's total.

Source colours reuse the asset-class tokens (`SOURCE_COLORS` in `income-view.ts`).

### Key files

- `frontend/src/features/income/passive-income.ts` — `nextMonths`, `incomeSchedule`, `incomeTotals`
- `frontend/src/features/income/hooks.ts` — `usePassiveIncome`
- `frontend/src/pages/income/IncomePage.tsx`, `IncomeMonthsChart.tsx`
- `frontend/src/pages/income/income-view.ts` — `receivedTotal`, `nextPayments`, `incomeBySource`, `monthLabel`
- `frontend/src/features/dividends/{api,hooks}.ts` — `received`, `useReceivedDividends`
- `frontend/src/demo/index.ts` — `GET /dividends/received` demo handler (`mockReceivedDividends`)

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Aggregate on the client | Dividend/SCPI forecast, rent and passbook projections are already served separately; the dashboard KPI uses the same hook | A backend aggregation endpoint (later lot) |
| Passbook interest booked in full on `nextCapitalizationDate` | That is when a passbook credits it | Spreading it over twelve months |
| "Dividends received" counts EUR credits only | `ReceivedDividend` carries the credit as booked, with no `amountEur` yet (backend lot) | Converting on the client with no rate for the payment date |
| Forecast only, no period switch | Every source is a projection from today; a past window would mix forecast with history | A period selector like the budget |

## Gotchas / Pitfalls

- `receivedTotal` is marked `shortcut:` in code: a non-EUR credit is left out of the hero's "received" figure.
- An upcoming dividend with no learned payment date is placed on its ex-date and flagged "ex-date" in the next-payments list.
- `incomeBySource` keeps only payments inside the schedule's months, so a payment 366 days out (the forecast horizon) never makes the rows disagree with the total.
- The empty state shows only when nothing is projected **and** nothing was received.

## Tests

- `features/income/passive-income.test.ts` — twelve months from the current one; dividends on payment date, SCPI apart, rent each month, interest at capitalisation.
- `pages/income/income-view.test.ts` — EUR-only received total, merged and capped next payments, payer rows inside the window.
- `pages/income/IncomePage.test.tsx` — empty state; payers listed and the link to Analysis when expenses are unknown.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `dividend-forecast.md`, `savings-livrets.md`, `real-estate-valuation.md`, `overview-dashboard.md`
