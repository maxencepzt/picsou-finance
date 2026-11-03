# Feature: Property & loans page (Immobilier & prêts)

> Last updated: 2026-11-03

## Context

Properties, SCPI shares and loans each had their own account page, and the dashboard carried a property roll-up card. `/real-estate` puts them on one page: what the bricks and shares are worth, what is still owed, what each loan costs, and how the monthly payments weigh against income. Every figure comes from existing endpoints.

## How it works

`frontend/src/pages/real-estate/RealEstatePage.tsx`, top to bottom:

1. **KPI row** (`KpiTile` ×6, only when there is a property or a SCPI): gross value, debt, net value (with its share of net worth), unrealised gain since purchase, loan-to-value, monthly rent. Gross, debt and net add the backend's property figures and its SCPI (`paper*`) figures.
2. **Properties** (`PropertyCard`, one per property): kind, city, surface, purchase date; purchase price, latest estimate (else the balance), its low–high range, price per m², valuation date; the co-ownership share; `PropertyValuationChart` when there are at least two estimates.
3. **SCPI** (`ScpiCard`): share count, subscription value, withdrawal value, yearly distribution, each weighted by the member's share.
4. **Loans** (`LoanCard`, one per visible `LOAN` account): remaining balance, monthly payment, capital repaid and instalments, total and remaining interest (`loanInterest` over the schedule), `LoanAmortizationChart`. A loan without terms shows its balance and asks for them: the schedule endpoint answers 404, so it is not called.
5. **Debt-to-income** (`DebtToIncomeCard`) and **card statements** (deferred-debit cards with a known amount or due date).

`Figure` is the page's label-over-figure unit (figures in ink).

### Key files

- `frontend/src/pages/real-estate/RealEstatePage.tsx` — page, KPI row, `ScpiCard`, `CardStatementsCard`
- `frontend/src/pages/real-estate/{PropertyCard,LoanCard,DebtToIncomeCard,Figure}.tsx`
- `frontend/src/pages/real-estate/real-estate.ts` — `DEBT_TO_INCOME_THRESHOLD`, `EMBEDDED_CARD`, `loanInterest`, `debtToIncome`, `monthYear`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Debt-to-income = `dashboard.totalMonthlyPayment` ÷ profile `monthlyNetBeforeTax`, against the 35 % HCSF cap | The lenders' definition is payments over net pay before income tax; the dashboard already sums every loan's monthly payment | Net after withholding; a ratio over a guessed income (null without one, with a link to Settings) |
| Loan-to-value includes SCPI | The page reads bricks and shares as one real-estate sleeve, so debt and gross both include them | Physical property only |
| Unrealised gain covers physical property only | `RealEstateSummaryResponse.unrealizedGain` is `grossValue − costBasis`, and `grossValue` holds properties only (SCPI sit in `paperGross`) | Mixing in SCPI subscription values |
| Embedded charts flattened with `EMBEDDED_CARD` | `PropertyValuationChart` and `LoanAmortizationChart` render their own `Card`; the class strips its background, padding and ring so they read as part of the page's card | A box within a box; forking the charts |

## Gotchas / Pitfalls

- The gauge runs 0–60 % and stretches past 60 % when the ratio is higher, so the bar never overflows; exactly 35 % is not flagged.
- `monthYear` builds the date from its parts, so no time zone moves `2023-06-01` back to May.
- The debt-to-income card waits for the profile and needs at least one loan and a known `totalMonthlyPayment` (null when no loan has a `Debt` row).

## Tests

- `pages/real-estate/real-estate.test.ts` — loan interest (total vs unpaid rows), debt-to-income (no income, gauge marks, threshold, stretched gauge), `monthYear` across time zones.
- `pages/real-estate/RealEstatePage.test.tsx` — both empty states and no KPI row; a loan without terms rendered from its balance.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `real-estate-valuation.md`, `scpi.md`, `loans.md`, `member-profile.md`, `account-ownership-shares.md`
