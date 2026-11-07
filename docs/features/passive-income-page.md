# Feature: Passive income page (Revenus passifs)

> Last updated: 2026-11-03

## Context

Dividends, SCPI distributions, rent and passbook interest were each visible somewhere (budget card, account pages, property summary, savings projection), never together. `/income` answers "what will my money pay me over the next twelve months, when, and from whom", from what the backend already projects, and sets it beside the dividends actually received over the last twelve months.

## How it works

`usePassiveIncome()` (`features/income/hooks.ts`) gathers three sources the backend serves separately:

- the dividend and SCPI forecast, `useUpcomingDividends(366)`;
- the monthly rent of the properties, `useRealEstateSummary().monthlyRentalIncome`;
- the yearly interest projection of each account with a `savingsConfig` (`savingsApi.getInterest`, one query per passbook).

`incomeSchedule(from, dividends, monthlyRent, savings)` (`features/income/passive-income.ts`) builds twelve `YYYY-MM` buckets from the current month: dividends and SCPI on their payment date (else the expected date), rent every month, a passbook's whole year of interest in the month of its `nextCapitalizationDate`. `incomeTotals` sums them per source. Any failed source fails the whole page: a silently missing source would understate the total.

`pages/income/IncomePage.tsx`, top to bottom:

1. **Hero**: projected total over twelve months, per month, dividends received over the last year (`useReceivedDividends(365)`, `GET /dividends/received`, summed in euros by `receivedTotal` from `amountEur`, whatever the account currency), a stacked bar by source with a wrapping legend (name and amount side by side, never cut), and coverage of essential expenses (its progress track lifted to `bg-foreground/10`, since the tile is already muted) (monthly income ÷ `monthlyEssentialExpenses` from the allocation targets; a link to `/analysis` when the expenses are not stated).
2. **Months** (`IncomeMonthsChart`), one money axis, a `SegmentedControl` "Received · Forecast · Both" (default Both). `incomeChartRows(months, received, period)` builds the bars: the twelve months up to the current one carry the dividends received, summed by credit month from `amountEur`, as solid bars; the twelve from the current one carry the forecast stacked by source, as lighter outlined bars (`color-mix` at 35 % with a full-colour stroke). The current month belongs to both sides, so Both shows 23 bars. A side a month does not belong to is `null`, so it draws no bar and no tooltip row. The legend lists "Dividends received" first, then each source "(forecast)"; ticks are evenly spaced (`interval="equidistantPreserveStart"`), the first one and January carry the year, and the tooltip names month and year. The chart grows to the height of its row. Credits with no rate (`amountEur` null) are left out of the bars and the hero, and a line under the chart counts them. A failed received request shows an `ErrorState` in the card unless the Forecast view is selected.
3. **Next payments**: the next eight dividends, distributions and capitalisations, soonest first (`nextPayments`).
4. **By payer**: one row per payer inside the schedule's window, largest first (`incomeBySource`): dividend payers and SCPI grouped by name, one row per passbook, one for rent. The rows add up to the schedule's total. Below `md` the type, rate and cadence columns are hidden, so a phone reads source, amount and date without a sideways scroll.

Source colours reuse the asset-class tokens (`SOURCE_COLORS` in `income-view.ts`).

### Key files

- `frontend/src/features/income/passive-income.ts` — `nextMonths`, `incomeSchedule`, `incomeTotals`
- `frontend/src/features/income/hooks.ts` — `usePassiveIncome`
- `frontend/src/pages/income/IncomePage.tsx`, `IncomeMonthsChart.tsx`
- `frontend/src/pages/income/income-view.ts` — `receivedTotal`, `incomeChartRows`, `nextPayments`, `incomeBySource`, `monthLabel`
- `frontend/src/features/dividends/{api,hooks}.ts` — `received`, `useReceivedDividends`
- `frontend/src/demo/index.ts` — `GET /dividends/received` demo handler (`mockReceivedDividends`)

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Aggregate on the client | Dividend/SCPI forecast, rent and passbook projections are already served separately; the dashboard KPI uses the same hook | A backend aggregation endpoint (later lot) |
| Passbook interest booked in full on `nextCapitalizationDate` | That is when a passbook credits it | Spreading it over twelve months |
| "Dividends received" summed from `amountEur` | The backend converts each credit to euros; a credit it cannot convert is left out and counted on screen, never guessed | EUR credits only (before `amountEur`); converting on the client |
| Received and forecast on one chart, told apart by fill | Same hue per source, solid for what landed, light and outlined for what is projected, explained in the legend | Two charts; a second axis |
| A three-way switch (received, forecast, both) | 23 bars are dense on a phone; one side alone reads better there | No switch; a free date range |
| Only dividends on the received side | `GET /dividends/received` serves credited dividends; rent and interest have no received history here | Inferring them from transactions |

## Gotchas / Pitfalls

- `amountEur` uses the latest known rate, not the rate of the credit date (see the `ReceivedDividend` type); a credit with no rate is left out and counted under the chart.
- The received side covers the twelve months up to the current one; a credit from the same month a year ago (inside the 365 days the hero sums) is in the hero total but not in the bars.
- The empty state needs nothing projected **and** no received row at all: credits with no rate still keep the page.
- An upcoming dividend with no learned payment date is placed on its ex-date and flagged "ex-date" in the next-payments list.
- `incomeBySource` keeps only payments inside the schedule's months, so a payment 366 days out (the forecast horizon) never makes the rows disagree with the total.

## Tests

- `features/income/passive-income.test.ts` — twelve months from the current one; dividends on payment date, SCPI apart, rent each month, interest at capitalisation.
- `pages/income/income-view.test.ts` — received total in euros across currencies (null skipped), chart rows for each period (window edges, current month on both sides, null sides), merged and capped next payments, payer rows inside the window.
- `pages/income/IncomePage.test.tsx` — empty state; credits with no rate keep the page and are counted; payers listed and the link to Analysis when expenses are unknown.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `dividend-forecast.md`, `savings-livrets.md`, `real-estate-valuation.md`, `overview-dashboard.md`
