# Feature: Recurring plan stats

> Last updated: 2026-11-03

## Context

A recurring investment plan says "500 € a month into CW8 and BTC" but nothing showed whether the
member actually bought, how regularly, and what those purchases are worth today. This endpoint
measures the plan against the `BUY` rows it describes.

## How it works

`GET /api/goals/{id}/recurring-stats` — `RecurringPlanStatsService.stats(goalId, memberId, today)`.

1. **Scope**: `GoalRepository.findByIdAndMemberId` → 404 (`ResourceNotFoundException.goal`) for
   another member's goal or an unknown id. A `SAVINGS_TARGET` → 400 (`IllegalArgumentException`).
2. **Window**: the last 12 calendar months, the current one included — from the 1st of the month
   11 months back — intersected with `[startDate, endDate ?? today]`.
   `monthsElapsed` = calendar months the window touches.
3. **Purchases**: `findByAccountIdInAndDateBetweenOrderByDateAsc` on the goal's accounts, kept
   when `txType = BUY`, the ticker (case-insensitive) is one of the goal's allocation tickers, and
   the quantity is non-zero. `monthsWithPurchase` = distinct months among them.
4. **Invested**: per purchase, `|qty| × pricePerUnit + |fees|` (the cost-basis rule of
   `HoldingComputeService` / `BalanceHistoryReconstructor`), or `|amount|` when the row has no
   unit price; weighted by the member's ownership share.
5. **Value**: Σ `|qty| × today's EUR price`, share-weighted. Prices come from
   `PriceService.getQuotes` (cache → provider → last snapshot ≤ 7 days), `getCryptoQuotes` for
   purchases on a CRYPTO account.
6. **Gain**: `currentValueEur − investedEur`, and `/ investedEur × 100` (2 dp).

```json
{ "from": "2026-01-15", "to": "2026-11-03",
  "investedEur": 1887.0, "purchases": 4, "monthsWithPurchase": 3, "monthsElapsed": 11,
  "currentValueEur": 2200.0, "gainEur": 313.0, "gainPercent": 16.59 }
```

Null rules: `currentValueEur`, `gainEur` and `gainPercent` are null when any purchased ticker has
no price (a partial sum would read as a loss). With no purchase, `currentValueEur` is 0 and both
gains are null: there is nothing to measure. Every key is always present (`@JsonInclude(ALWAYS)`).

**Frontend.** `RecurringPlanStats` (`frontend/src/pages/goals/RecurringPlanStats.tsx`, hook `useRecurringStats`, key `['goals', id, 'recurring-stats']`) sits on each recurring-plan card. It shows "Purchases since <from>" (it quotes `from`, because the window starts on the 1st of the month 11 months back and is cut to the plan's dates), then the amount invested, the months with a purchase as "11 / 12", the current value, and the gain as a `Delta`. A null value means a price is missing: value and gain read "—" and a line gives that reason. No purchase also reads "—", with its own line. A plan with no split shows a hint, because purchases are matched on its tickers. A plan whose window has not started shows nothing.

### Key files

- `controller/GoalController.java` — `GET /api/goals/{id}/recurring-stats`
- `service/RecurringPlanStatsService.java`
- `dto/RecurringStatsResponse.java`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Calendar-month window ending in the current month | `monthsWithPurchase ≤ monthsElapsed` always, so "11 / 12 months" reads right | `today − 12 months`, which touches 13 calendar months |
| Value = bought quantity × today's price | Measures the plan's own purchases, not the whole account (which may hold older lines) | The account's live balance |
| A separate service | `GoalService` stays about progress; this needs prices and transactions it does not use | Two more dependencies on `GoalService` |

## Gotchas / Pitfalls

- The current month counts as elapsed even before its purchase day, so a perfectly regular plan
  reads 11 / 12 until the month's buy lands.
- A plan with no allocation lines (the member never detailed the split) has no ticker to match:
  0 purchases.
- A `BUY` without quantity is skipped (it cannot be valued), so it is not counted either.
- `from` can be after `to` when the plan starts in the future or ended before the window; the
  response then has zero counts and `monthsElapsed: 0`.
- Sales are ignored: the value is what the plan bought, even if some was sold since.

## Tests

- `RecurringPlanStatsServiceTest` — window intersection (start and end), months with a
  purchase, non-allocation tickers / SELL / DIVIDEND ignored, cost with fees and without unit
  price, crypto quotes, share weighting, unknown price → null value and gain, savings target →
  400, another member's goal → 404.

## Links

- [goal-recurring-investment.md](./goal-recurring-investment.md), [goals.md](./goals.md),
  [price-service.md](./price-service.md)
