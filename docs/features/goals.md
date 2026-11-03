# Feature: Goals

> Last updated: 2026-11-03

> **Goals now have a type.** This note describes `SAVINGS_TARGET`, which is what every goal was
> and still is by default. The second shape — a monthly investment with no target and no deadline
> — is documented in [goal-recurring-investment.md](./goal-recurring-investment.md), along with
> the removal of `chk_goal_deadline`, a V2 constraint that had been silently blocking every
> update to an expired goal.

## Context

Picsou lets users define savings goals with a target amount and deadline. Goals are linked to one or more accounts (M:N relationship). Progress is computed from the current balances of linked accounts compared to the target. Monthly tracking shows how much has been saved each month versus how much is needed, with optional per-month overrides.

## How it works

### Goal-Account relationship

A `Goal` has a M:N relationship with `Account` via the `goal_account` join table. An account can belong to multiple goals, and a goal can have multiple accounts. When progress is calculated, the balances of all linked accounts are summed.

### Progress calculation

`GoalService.toProgressResponse()` computes:

- **currentTotal**: Sum of `liveBalanceEur()` across all linked accounts. For holding accounts, this uses live prices from `PriceService` (with PnL). For cash accounts, falls back to stored balance converted to EUR.
- **percentComplete**: `(currentTotal / targetAmount) * 100`, rounded to 4 decimal places.
- **monthsLeft**: `ChronoUnit.MONTHS.between(today, deadline)`, minimum 0.
- **monthlyNeeded**: `(target - currentTotal) / monthsLeft`. If deadline has passed, the entire remaining amount is the monthly need.
- **avgMonthlyContribution**: Average monthly balance increase over the last 3 months across all linked accounts, computed from `BalanceSnapshot` history. **Fallback for manually-tracked goals**: when no linked account has snapshot data (`accountsWithData == 0`), the average is computed from the recorded `GoalManualContribution` entries instead (sum ÷ count), so backfilled manual history refines the figure. Returns `null` only when neither source has data. Displayed in the UI but no longer drives `isOnTrack`.
- **isOnTrack**: `Σ effective(past months) >= Σ objective(past months)`. `effective` = `manualActual ?? snapshot-delta` (months with neither are skipped). `objective` = `override ?? monthlyNeeded`. "Past" = strictly before the current month (current month is in progress). Returns `true` when the goal has no `createdAt`, no past month, or no past month with data (benefit of the doubt).

### Monthly tracking

`GoalService.getMonthlyEntries()` generates a month-by-month breakdown from the *effective start month* to the deadline. The effective start is the goal's `createdAt` month, unless `Goal.historyStartMonth` is set to an earlier month (see **History backfill** below). For each month:

- **objective**: The auto-computed `monthlyNeeded`.
- **actual**: The real balance delta for that month (from snapshots: end-of-month balance minus end-of-previous-month balance). `null` for future months.
- **manualActual**: A manually entered contribution amount (from `GoalManualContribution`). Takes precedence over computed actual.
- **override**: A per-month override for the objective (from `GoalMonthOverride`). Stored but tracked alongside the auto-computed value.
- **effective**: `manualActual` if set, otherwise `actual`.

### Overrides and manual contributions

Two separate override mechanisms:

- **GoalMonthOverride**: Overrides the monthly savings *objective* for a specific month. Useful when the user plans to save more or less than the computed target.
- **GoalManualContribution**: Overrides the monthly savings *actual* for a specific month. Useful when the user wants to track contributions that don't appear in account balances (e.g. cash savings).

### History backfill (before goal creation)

Users often start a goal in Picsou after they've already been saving for it. The backfill feature lets them extend the calendar *earlier* than the goal's creation date so they can record that prior history (typically as manual contributions).

- **`Goal.historyStartMonth`** (`VARCHAR(7)`, nullable, format `"YYYY-MM"`): when set and earlier than the `createdAt` month, the monthly calendar starts from this month. `null` keeps the default (`createdAt`-derived) start. Added in migration `V32__goal_history_start.sql`.
- **`GoalService.effectiveStartMonth(goal)`**: returns `min(createdAt month, historyStartMonth)` — the single source of truth for where the calendar begins.
- **`POST /api/goals/{id}/history/extend`** → `GoalService.extendHistory()`: decrements the effective start by one year and persists it as the new `historyStartMonth`. The frontend exposes this via a slim "+ Add {year}" card above the calendar (`useExtendGoalHistory`), where `year = earliestRenderedYear - 1`.
- **`POST /api/goals/{id}/history/extend/month`** → `GoalService.extendHistoryByMonth()`: same mechanism but decrements the effective start by a single month — for fine-grained backfill (e.g. only the earlier months of the current year, before goal creation). The frontend exposes this via a "+ previous month" card prepended to the earliest year's month row in the grid (`useExtendGoalHistoryByMonth`). Both endpoints coexist: yearly jumps and month-by-month refinement.
- Backfilled months have no snapshot data, so they render empty until the user fills them in manually.
- **`isOnTrack` is deliberately NOT affected by backfill**: it stays anchored to `createdAt` (`isOnTrackFromPastMonths` is unchanged). Backfill is history-only — when actuals come from linked accounts, extending the window backwards must not retroactively change the "on track" verdict. Backfilled manual contributions *do* feed `avgMonthlyContribution` (see above), refining the "average monthly" figure for manually-tracked goals.

### Key files

- `backend/src/main/java/com/picsou/service/GoalService.java` -- Business logic: CRUD, progress calculation, monthly tracking, overrides
- `backend/src/main/java/com/picsou/controller/GoalController.java` -- REST endpoints under `/api/goals/`
- `backend/src/main/java/com/picsou/model/Goal.java` -- JPA entity: name, targetAmount, deadline, M:N accounts, `historyStartMonth`
- `backend/src/main/resources/db/migration/V32__goal_history_start.sql` -- adds the nullable `history_start_month` column
- `backend/src/main/java/com/picsou/model/GoalMonthOverride.java` -- Per-month objective override (goal_id, yearMonth, amount)
- `backend/src/main/java/com/picsou/model/GoalManualContribution.java` -- Per-month actual override (goal_id, yearMonth, amount)
- `backend/src/main/java/com/picsou/repository/GoalRepository.java` -- `findAllWithAccounts()` for eager fetching
- `backend/src/main/java/com/picsou/repository/GoalMonthOverrideRepository.java` -- Override lookup by goal + month
- `backend/src/main/java/com/picsou/repository/GoalManualContributionRepository.java` -- Contribution lookup by goal + month
- `frontend/src/pages/goals/GoalsPage.tsx` -- Grid of goal cards (`GoalCard`), CRUD dialog, status badges
- `frontend/src/pages/goals/GoalsKpiRow.tsx`, `GoalTrajectory.tsx`, `goal-stats.ts` -- KPI row, the card's trajectory chart and forecast sentence, their pure helpers (`goalStatus`, `summarizeSavings`, `projectReach`, `trajectoryRows`)
- `frontend/src/pages/goals/GoalCalendarPage.tsx` -- Monthly calendar view with donut rings, overrides, manual contributions

### Flow

```
Create goal (name, targetAmount, deadline, accountIds)
        |
        v
GoalService.create() --> save Goal with linked accounts
        |
        v
GoalService.toProgressResponse()
        |
        +-- sum liveBalanceEur() per account --> currentTotal
        +-- compute monthsLeft, monthlyNeeded
        +-- calculateAvgMonthlyContribution() from snapshots
        +-- determine isOnTrack
        |
        v
Get monthly entries:
        |
        v
GoalService.getMonthlyEntries(goalId)
        |
        +-- for each month from creation to deadline:
        |       +-- calculateActualForMonth() from snapshots
        |       +-- lookup GoalManualContribution
        |       +-- lookup GoalMonthOverride
        |       +-- build GoalMonthEntryResponse
        |
        v
Set month override:
GoalService.setMonthOverride(goalId, yearMonth, amount)
        --> upsert GoalMonthOverride
        --> return updated entry
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| M:N goal-account relationship | A savings goal often spans multiple accounts (checking + savings + PEA) | One account per goal (too restrictive) |
| Snapshot-based actual calculation | Uses existing BalanceSnapshot data; no need for a separate transaction import | Dedicated savings transaction table |
| Separate override + manual contribution | Different semantics: override changes the target, manual contribution changes the actual | Single override field (loses information) |
| 3-month average for `avgMonthlyContribution` | Short enough to reflect recent behavior, long enough to smooth out noise | 6-month or 12-month average (too slow to reflect changes) |
| `isOnTrack` from cumulative past months | Single source of truth with the `/goals/:id/calendar` view; lets the user influence the badge indirectly via overrides + manual contributions | Snapshot-based 3-month average (decoupled from what the calendar shows; could not be influenced by user adjustments) |
| `null` for no history | Distinguishes "no data yet" from "zero contribution"; `isOnTrack` treats null as "benefit of the doubt" | Return zero (would mark new goals as "not on track") |
| `liveBalanceEur()` for currentTotal | Holding accounts show real portfolio value with PnL, not stale sync-time balance | `AccountResponse.currentBalanceEur` (does not reflect live prices) |
| Linked accounts listed by name in the card's stats | No per-account colour on a goal card; the names are what the reader looks for | Per-account pastel `<span>` with `style={{ background: a.color }}` |
| Status badges on semantic tokens (`gain`, `primary`, `warning`) | One badge shape, the colour carries the state in both themes | Raw palette classes (`bg-green-500/10`) |

## Gotchas / Pitfalls

- **A `GoalMonthOverride` changes the month's *objective*, never the amount saved.** `getMonthlyEntries` used to put the override into `effective` (the amount saved) while leaving `objective` at the computed value, so a month whose target was lowered to 200 showed "200 saved of 500" whatever the real contribution. `effective` is now `manualActual ?? actual` and `objective` is `override ?? monthlyNeeded`, the semantics `isOnTrackFromPastMonths` always had.
- **`avgMonthlyContribution` is a sum over the linked accounts**, each averaged over its own months. It is compared with the goal-level `monthlyNeeded` (`surplus`), so a per-account mean (three accounts saving 100 each reported 100) understated progress by the number of accounts.
- **Accounts can belong to multiple goals**: If an account is linked to two goals, its full balance counts toward both goals' `currentTotal`. There is no "partial allocation."
- **Monthly actual is computed from snapshots, not transactions**: The actual savings for a month is the delta between end-of-month snapshot balances. If snapshots are missing (e.g. new account, no sync), that month will have `null` actual.
- **Override does not recalculate monthlyNeeded**: Setting a month override changes the display value for that month but does not affect the computed `monthlyNeeded`. The auto-computed objective is always based on `(target - current) / monthsLeft`.
- **Effective-start to deadline range**: `getMonthlyEntries()` iterates from the effective start month (`min(createdAt, historyStartMonth)`) to the deadline month. If the goal was created mid-month, the first month's actual may be partial. Backfilled months (before `createdAt`) never have snapshot data.
- **`findAllWithAccounts()` uses a custom query**: Goals are fetched with their accounts eagerly loaded to avoid N+1 queries during progress calculation.
- **Account membership is member-scoped (IDOR guard)**: `create`/`update` resolve `accountIds` via `accountRepository.findByIdInAndMemberId(...)`, never the inherited `findAllById`. A caller can only attach accounts they own; a foreign/nonexistent id fails the size check with a generic 400. Do **not** revert this to `findAllById` — that re-opens a cross-member balance-disclosure IDOR (security audit 2026-06-27, CWE-639).

## Tests

- `GoalServiceTest` -- unit tests for progress calculation, monthly entries, overrides, edge cases (deadline passed, no history)
- `frontend/src/pages/goals/goal-stats.test.ts` -- the badge verdict, the KPI sums (achieved goals left out of required and averaged), the reach month (rounding up, exact divisions, year boundary, late by at least one month, never), the trajectory rows (start at creation, older goal, passed deadline, too few points)
- `e2e/goals.spec.ts` -- each demo savings card shows its progress bar and its trajectory chart

## Frontend notes

- **Goal card** (`GoalCard`, since the "Coffre Nocturne" redesign): current total over target and its percentage, a progress bar, then deadline, **required** monthly effort (`monthlyNeeded`, in `warning` when behind) beside the **average** one (`avgMonthlyContribution`, "–" without history), and the linked accounts by name. Edit, calendar and delete sit in the card footer; a click elsewhere on the card opens `GoalDetailModal`. Cards sit in an auto-fill grid. No per-account colour: the `ACCOUNT_COLORS` palette is still used elsewhere (ColorPicker, the Finary and Actual Budget imports) but not in goal cards.
- **Status**: a dot and a word (`StatusDot` in `Stat.tsx`), never a filled badge — achieved and on track in `gain`, behind in `warning`, waiting (no average yet) muted; a recurring plan is active (`gain`), upcoming or done (muted). The verdict comes from `goalStatus` (`goal-stats.ts`), which the KPI row and `GoalDetailModal` share (the modal used to read `isOnTrack` alone, with blue and red filled badges).
- **KPI row** (`GoalsKpiRow`, above both sections, built from `GET /api/goals` alone): total saved over the total target with its percentage; goals achieved or on track out of all savings goals, with the number behind; the summed **required** monthly effort beside the summed **average** of the same goals (those not yet achieved, so the two compare); and the monthly amount of the running recurring plans. An account linked to two goals counts in both totals, as it does on each card.
- **Trajectory on the card** (`GoalTrajectory`): a 64px chart from `GET /api/goals/{id}/history` (`useGoalHistory`) — the linked accounts' total since the goal's creation (or over the 12 months of history when the goal is older) as a `--chart-1` line, against a dashed `--chart-5` straight line from that first balance to the target at the deadline, both axes hidden, the Y axis zoomed between the lowest value and the target so the gap to the line shows. A two-entry legend sits under it and the chart carries an `aria-label`. Loading shows a skeleton, an error a retry link that does not open the detail, fewer than two points a sentence. The full chart with tooltips stays in `GoalDetailModal`.
- **Forecast sentence**: the goal response has no projected date, so `projectReach` computes it from `avgMonthlyContribution`: `n = ⌈(target − current) / average⌉` months, the current month counting as the first, so reached at the end of month `today + n − 1`. "Reached in <month year> at the average pace of X / month"; when that month ends after the deadline, "N months late" (at least one) in `warning` with an icon; with an average of zero or less, or more than 50 years away, "not reached at the average pace of X / month". Nothing is said for a goal already reached or without history. The sentence can disagree with the badge on purpose: the badge looks at past months against their objectives, the sentence at the recent pace going forward.
- **Forecast with a falling balance**: when the average is negative, the sentence says the linked savings shrink by X / month (`goals.trajectory.shrinking`) instead of "not reached at the average pace of -3 € / month". Per-month captions (`goals.card.perMonth`) use non-breaking spaces so "/ month" never ends up alone on a line.
- **Sections**: "Savings goals" and "Recurring investments" are small-bold ink headings. The savings-rate card (`SavingsRateCard`: title with the benchmark tooltip, rate, contributions / income, a bar) is a cell of the recurring grid, top-aligned, instead of a full-width band.
- **Form**: the goal type is a `SegmentedControl` (fill), the name field has its own label (`goals.nameLabel`, it read "Goals"), two-column fields stack on a phone, and the included accounts sit in a bordered list of 40px rows with the balance in ink.
- **Detail modal**: `sm:max-w-4xl`, the target amount in ink (it was slate), the four stats on two columns on a phone, linked accounts as small rounded chips.
- **Calendar dots and labels**: see [goal-calendar-donut.md](./goal-calendar-donut.md) — theme tokens only, translated captions.
- **Icons**: from `lucide-react` (not HugeIcons) in the goals pages.
- **Goal detail chart**: `GoalDetailModal` reuses the shared `NetWorthChart` with the optional `target`, `projection`, and `todayMs` props. The chart draws:
  - A dashed `var(--chart-3)` ideal trajectory from `(goal.createdAt, balanceAtCreation)` to `(goal.deadline, goal.targetAmount)`, where `balanceAtCreation` is the first history point at or after `goal.createdAt`. Using the baseline (not zero) keeps the trajectory in the same reference frame as the live area, so the visual matches the "behind/on track" badge.
  - A dotted `var(--muted-foreground)` "at current pace" projection from `(today, currentTotal)` to `(goal.deadline, currentTotal + avgMonthlyContribution * monthsLeft)`, rendered as an `Area` with a faint left→right gradient so the chart fades into the future rather than cutting net at today. Skipped when `avgMonthlyContribution` is null (no history yet).
  - A vertical "today" reference line marking the boundary between past data and future projection. Only drawn when a target/projection extends past the data.
  - When `target` is set, history is cropped on the left to `target.startDate`. On the `ALL` range, the X axis is stretched right up to the deadline so the projection beyond today is visible.
  - The goal modal passes `showInvested={false}` to declutter the legend (capital-invested is irrelevant for a savings goal).
  - The `target`/`projection`/`todayMs` props are opt-in: Dashboard / Accounts / AccountDetail don't pass them and remain unchanged.

## Links

- Related feature: [Bank sync](./bank-sync.md) (provides balance snapshots)
- Related feature: [Price service](./price-service.md) (EUR conversion for account balances)
