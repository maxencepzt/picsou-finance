# Feature: Financial independence (Analysis)

> Last updated: 2026-11-03

## Context

The projection says how much the investable wealth may be worth; it does not say when it would be enough to live on. The Analysis page answers that with a card (where the member stands today) and a simulator (what one more euro a month, a better return or lower expenses would change). Pure front-end arithmetic over data already loaded.

## How it works

`AnalysisPage` gathers a `FiBaseline` once every input has loaded (a half-loaded profile would print a duration, then switch to an age):

| Input | Source |
|---|---|
| `start` | `financialAssets(useDashboard().distribution)`: positive balances of the cash, savings, equity, crypto and funds classes; property, SCPI and debts are out |
| `pace` | profile `monthlySavingsCapacity`, else `max(0, net)` of the current budget cycle (`useCashflow('CYCLE')`) |
| `expenses` | `monthlyEssentialExpenses` from the allocation targets, else `DEFAULT_EXPENSES` (2 000), labelled as a default on screen |
| `age`, `retirementAge` | `useMemberProfile()` (`age`, `targetRetirementAge`) |

`fi-math.ts`:

- target = `expenses × 12 ÷ withdrawal rate` (`fiTarget`);
- yearly compounding, then a year of savings: `capital × (1 + r) + monthly × 12` (`capitalAfter`, `yearsToTarget`);
- `yearsToTarget` gives up after `MAX_YEARS` (60) and returns null, shown as "Over 60 years" or "After age N".

`FinancialIndependenceCard` uses the defaults (5 % return, 4 % withdrawal): target, financial assets and progress toward it, estimated age (or duration without a birth date) and the stated retirement age. `FinancialIndependenceSimulator` has four sliders (savings 0–3 000 €/month, return 0–10 %, expenses 1 000–5 000 €, withdrawal 2.5–5 %), savings presets, and compares the result with the current pace on one time axis, with the retirement age as a marker. Slider moves are stored as overrides on top of the baseline, so untouched hypotheses follow the profile and budget when they arrive; Reset clears them.

### Key files

- `frontend/src/pages/analysis/fi-math.ts` — `financialAssets`, `currentPace`, `fiTarget`, `capitalAfter`, `yearsToTarget`, `snap`, defaults
- `frontend/src/pages/analysis/FinancialIndependence.tsx` — card and simulator
- `frontend/src/pages/analysis/AnalysisPage.tsx` — baseline assembly

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Yearly compounding, answer in whole years | A simulator to compare hypotheses, not a schedule | Mirroring `ProjectionService`'s monthly maths |
| Financial assets only | What a retirement can be drawn from by selling it off; property and SCPI are left out | Net worth |
| A labelled default for expenses | The card stays useful before the targets are filled, and says the figure is not the member's | No card until expenses are stated |
| Durations instead of ages without a birth date | An age needs one; the card links to Settings to add it | Hiding the result |

## Gotchas / Pitfalls

- The baseline pace never goes negative: a cycle in deficit counts as zero savings.
- The simulator snaps the baseline onto each slider's grid (`snap`), so the "today" preset may differ slightly from the raw pace.
- The comparison bars share one time axis: at least 10 years, up to age 70 or the retirement age plus five.

## Tests

- `pages/analysis/fi-math.test.ts` — target, compounding, years to target, out of reach, financial assets only, pace fallback, slider snap.
- `pages/analysis/FinancialIndependence.test.tsx` — age at the current pace, duration and profile link without a birth date, a higher savings rate against the current pace, then reset.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `wealth-pyramid.md`, `goal-recurring-investment.md` (the projection beside it), `member-profile.md`
