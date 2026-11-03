# Feature: Investment performance, benchmark and fees

> Last updated: 2026-11-03

## Context

The dashboard shows what the investments are worth and their P&L against cost. It does not
answer the questions an investor actually asks: what did my money earn once deposits are taken
out, how did that compare with the market, and what am I paying for it? Three read-only
endpoints on `/api/analysis` answer them.

## How it works

### Which accounts count

The member's readable, **non-hidden** accounts whose type is `AssetClass.INVESTMENT` — `PEA`,
`COMPTE_TITRES`, `CRYPTO`, `ASSURANCE_VIE`, `PER`, `EMPLOYEE_SAVINGS` — minus Revolut pocket
sub-accounts (their balance is already in the parent). Each counts at the member's ownership
share, through `AccountAccessResolver` as on the dashboard.

### `GET /api/analysis/performance?months=12`

`months` ∈ {3, 6, 12, 36, 60, 0}; 0 is all history (HistoryService's 1200-month "ALL"). Anything
else is a 400.

The series is `HistoryService.buildHistory` over the accounts above: the daily, forward-filled sum
of `balance_snapshot.balance` (V) and `invested_amount` (I), weighted by share, with today's point
replaced by a live valuation. It is the dashboard chart's series restricted to investments.
`PerformanceCalculator` then computes, with flow `F_t = I_t − I_{t−1}`:

| Field | Formula | Null when |
|---|---|---|
| `points[].index` | 100 × Π(1 + r_t), first point 100 | never (empty list instead) |
| `twrPercent` | (Π(1 + r_t) − 1) × 100, with r_t = (V_t − F_t) / V_{t−1} − 1, skipped when V_{t−1} ≤ 0 | no return could be measured |
| `annualizedPercent` | ((1 + TWR)^(365 / span days) − 1) × 100 | span < 365 days |
| `volatilityPercent` | sample stdev of r_t × √(365 / mean gap in days) × 100 | fewer than 20 returns |
| `maxDrawdownPercent` | worst `index / running peak − 1` (≤ 0), with the peak and trough dates | no points; 0 with null dates when it never fell |
| `xirrPercent` | rate r solving −V_0 at `from`, −F_t on each flow day, +V_T at `to` (365-day year) | span < 30 days, no sign change, or an unknown basis |

`from`/`to` are the first and last point dates (history can start later than the window); with no
points they are the requested window. `valueEur`/`investedEur` are the last point's, 0 when empty.

`Xirr` solves by bisection between −99.99 %/yr and an upper bound grown ×10 up to 1 000 000 %/yr:
a bracket either has a sign change or proves there is no root, so a non-answer is `null` rather
than a diverged Newton step.

### `GET /api/analysis/benchmark?key=MSCI_WORLD&months=12`

`key` is the `BenchmarkKey` enum — `MSCI_WORLD` → `IWDA.AS`, `SP500` → `SXR8.DE`, `CAC40` →
`C40.PA`, all EUR-quoted UCITS ETFs on the Yahoo adapter. An unknown key fails enum binding (400);
no request ever names a ticker.

The endpoint is **read-only**: it returns the `price_snapshot` rows for the mapped ticker over
the window (`months=0`: every cached day), and `points` is `[]` until something has written them.
A GET never changes state (`backend/CLAUDE.md`), so the series is filled by the existing price
jobs, both reading the tickers from `BenchmarkKey.tickers()`, the single list:

- **`PriceBackfillRunner`** (startup): after the held tickers' 12 months, backfills the benchmarks
  over 60 months on the generic (non-crypto) route. 60 is the Yahoo adapter's longest daily range
  (`5y`). `backfillHistoricalPrices` skips a ticker whose cached days already cover the range.
- **`SchedulerService.refreshPrices`** (hourly): adds the benchmarks to the non-crypto set, so
  `PriceService.refreshPrices` upserts today's row for them like for any held ticker. That is
  what makes the series grow by one day per day.

Both skip the benchmarks when nothing at all is held, as they already skipped everything else: an
empty instance has no performance to compare, and a booting `@SpringBootTest` context (scheduling
is enabled) must not reach Yahoo.

### `GET /api/analysis/fees?months=12`

- **Lines**: every priced holding of the accounts above (`AccountService.getHoldings(Account)`),
  weighted by share and merged by ticker; a crypto account's coin is kept apart from a listed
  security with the same symbol. `terPercent` is `security_profile.ter_percent`, null for shares,
  coins, and funds no source has a TER for. Sorted by value, largest first.
- `coveredValueEur` = value of lines with a TER; `totalValueEur` = value of every line.
- `weightedTerPercent` = Σ(value × TER) / covered (3 decimals); `annualCostEur` = Σ(value × TER / 100).
  Both **null** when no line has a TER, never 0.
- **Broker fees** over `[from, to]`: per transaction, `|fees|` plus `|amount|` when
  `txType = FEE`, converted to EUR from the account currency and weighted by share;
  `brokerFeesCount` counts the transactions that carried one. With `months=0`, `from` is the
  earliest transaction found (today when none).

### Where the TER comes from

It was already there. `V99__security_profile_fund_facts.sql` added `security_profile.ter_percent`
and the weekly `SecurityProfileRefreshRunner` → `SecurityProfileService.refresh` fills it from
**justETF** (`JustEtfProvider`, keyed on the fund's ISIN, field `tl_etf-basics_value_ter`), merged
field by field so a source without a fee never erases one. No new migration was needed. See
[portfolio-diversification.md](./portfolio-diversification.md) for the provider order.

### Where it is shown

On `/investments` (see [investments-page.md](./investments-page.md)): `PerformanceCard` shows the
five metrics for a chosen period, a dash with its reason for every null one, and `PerformanceChart`
draws `points[].index` against a benchmark rebased to 100 on the first shared date; `FeesCard` shows
the weighted TER, coverage, the costliest lines and the broker fees over 12 months. The hooks are
`usePerformance`, `useBenchmark` and `useFees` in `frontend/src/features/analysis/hooks.ts`.

### Key files

- `backend/src/main/java/com/picsou/controller/AnalysisController.java` — the three GETs
- `backend/src/main/java/com/picsou/service/InvestmentPerformanceService.java` — account selection, currency, shares
- `backend/src/main/java/com/picsou/service/PerformanceCalculator.java` — TWR, index, volatility, drawdown, XIRR flows
- `backend/src/main/java/com/picsou/service/Xirr.java` — bisection solver
- `backend/src/main/java/com/picsou/dto/BenchmarkKey.java` — benchmark whitelist, the only list of their tickers
- `backend/src/main/java/com/picsou/config/PriceBackfillRunner.java`, `service/SchedulerService.java` — fill the benchmark series
- `backend/src/main/java/com/picsou/dto/PerformanceResponse.java`, `BenchmarkResponse.java`, `FeesResponse.java`

### Flow

```
performance: readableAccounts → investment filter → HistoryService.buildHistory → PerformanceCalculator
benchmark:   BenchmarkKey → price_snapshot (read only)
             PriceBackfillRunner (5y at boot) + SchedulerService.refreshPrices (daily row) → price_snapshot
fees:        investment accounts → getHoldings(Account) + SecurityProfile.terPercent
             + TransactionRepository.findByAccountIdInAndDateBetweenOrderByDateAsc
```

## Technical choices

| Choice | Why | Rejected alternative |
|---|---|---|
| Reuse `HistoryService.buildHistory` | Same forward fill, shares and live today point as the dashboard chart, so the two never disagree | A second snapshot reader |
| Pure `PerformanceCalculator` / `Xirr` on doubles | Testable with hand-checked numbers; statistics need `sqrt`/`pow` anyway | BigDecimal maths in the service |
| Bisection for XIRR | Always terminates; no root is detected, not diverged into | Newton–Raphson |
| `@JsonInclude(ALWAYS)` on the response records | The contract sends nulls; the app default `non_null` omits them | Leaving keys out |
| Benchmark fed by the price jobs, endpoint read-only | A GET must not change state; the jobs already own every `price_snapshot` write | Backfilling on request (first version) |
| `getHoldings(Account)` overload | The id-based form only admits the owner, so a co-owner would 404 | Calling `getHoldings(id, memberId)` |

## Gotchas / Pitfalls

- **The flow is the change in cost basis, not a cash deposit.** A sale at a gain leaves value
  unchanged (shares become envelope cash, which counts as invested at face value) while the basis
  rises by the realised gain: that day reads as a negative return of the same size. Accurate
  external flows would need DEPOSIT/WITHDRAWAL transactions, which not every connector supplies.
- **Snapshots must be daily for the TWR to be clean.** The forward fill starts at `from` with no
  row before it, so an account whose first in-window snapshot arrives late enters as a flow equal
  to its invested amount: its unrealised P&L at that moment shows up as a return.
- **Unknown basis (Caisse d'Epargne PER).** `buildHistory` reports `invested = null` when a PER's
  cost basis is incomplete. The point is sent with `investedEur: null`, returns touching it are
  skipped, and `xirrPercent` is null for the whole window.
- **Weekend snapshots** have flat prices, so most of those returns are zero; volatility is
  annualised with the real mean gap (≈1 day) and √365, as the contract specifies, not 252 trading days.
- **Short windows give large XIRRs**: a 5 % gain over 40 days annualises to ~56 %/yr. XIRR is
  null below 30 days, annualised TWR below 365.
- **A TER exists only for funds justETF resolved** — the profile needs an ISIN and a refresh since
  V99. Anything else is uncovered, which `coveredValueEur` vs `totalValueEur` makes visible.
- **The benchmark is short on a fresh instance.** The startup backfill skips while nothing is
  held, so after the first sync only the hourly refresh's daily row accumulates; the five years
  arrive at the next boot. Its weekend rows carry Friday's price, like every
  held ticker's, because the hourly refresh records "today" whatever the market did.
- **Broker fees use today's FX rate** for non-EUR accounts (a `shortcut:` comment marks it).

## Tests

- `PerformanceCalculatorTest` — empty, single point, flat series, deposit, zero base, known drawdown,
  one-year 10 %, mid-year deposit XIRR (10.0713 %), volatility of ±1 % days, unknown basis
- `XirrTest` — Excel's documented example (37.3362535 %), a loss, no root
- `InvestmentPerformanceServiceTest` — account filter, ALL range, empty, bad window, benchmark
  served from the cache with no provider call, fee merging/shares/TER, null-not-zero
- `PriceBackfillRunnerTest`, `SchedulerServiceTest` — the benchmark tickers are backfilled (60
  months, non-crypto) and refreshed hourly alongside the held ones, and not at all when nothing is held
- `AnalysisResponsesJsonTest` — nulls survive the global `non_null` setting
- `AnalysisControllerTest` — member scoping

## Links

- Related ADR: [ISIN-keyed lookups and justETF](../decisions/2026-08-15-isin-keyed-lookups-and-justetf.md)
- Related: [price-service.md](./price-service.md), [portfolio-diversification.md](./portfolio-diversification.md)
