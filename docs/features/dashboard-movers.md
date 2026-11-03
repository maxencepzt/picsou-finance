# Feature: Dashboard movers

> Last updated: 2026-11-03

## Context

The overview answers "where do I stand?" but not "what moved since yesterday?". This endpoint
lists the held securities that rose or fell most between their two latest recorded prices, so
the dashboard can show the top gainers and losers without a provider call on render.

## How it works

`GET /api/dashboard/movers?limit=5` (`limit` clamped to 1..10, per list).

1. **Perimeter**: the member's readable accounts (`AccountAccessResolver.readableAccounts`), not
   hidden, of a type that holds positions: `AccountType.isInvestment()` (PEA, COMPTE_TITRES,
   CRYPTO, ASSURANCE_VIE, PER) plus EMPLOYEE_SAVINGS.
2. **Positions**: `AccountHoldingRepository.findPositiveByAccountIdIn`, merged by upper-cased
   ticker across accounts. Each line's quantity is weighted by the member's ownership share
   (`AccountAccessResolver.weigh`, the same rule as `DashboardService`), then summed.
3. **Prices**: `PriceSnapshotRepository.findRecentByTickers` over the last 10 days, one query.
   A ticker needs two snapshot days; its two newest give `priceEur` and `previousPriceEur`.
4. **Figures**: `changePercent = (p1 − p0) / p0 × 100` (2 dp), `valueEur = qty × p1`,
   `valueChangeEur = qty × (p1 − p0)` (2 dp, share-weighted quantity).
5. **Split**: `changePercent > 0` → `gainers` (desc), `< 0` → `losers` (asc), ties by ticker,
   each cut to `limit`. `0.00` sits in neither list.
6. **Logo**: `InstrumentLogoService.storedUrls` (one query, no network) for tickers held on a
   non-crypto account; crypto lines and tickers with no stored mark get `logoUrl: null`.

```json
{
  "date": "2026-11-03", "previousDate": "2026-11-02",
  "gainers": [{ "ticker": "AAPL", "name": "Apple", "logoUrl": "/api/instrument-logos/AAPL?v=1",
                "priceEur": 190.1, "previousPriceEur": 185.0, "changePercent": 2.76,
                "valueEur": 3802.0, "valueChangeEur": 102.0 }],
  "losers": []
}
```

`date` / `previousDate` are the newest latest-day and the newest previous-day among the compared
tickers; both are null (and the lists empty) when no held ticker has two snapshots. Every key is
always present: the DTO is `@JsonInclude(ALWAYS)` against the app-wide `non_null`.

### On the dashboard

`MoversCard` (`frontend/src/pages/dashboard/MoversCard.tsx`, hook `useMovers(5)` in
`features/dashboard/hooks.ts`, key `['dashboard', 'movers', 5]`) sits next to the peers card. A
`SegmentedControl` switches between gainers and losers and opens on the side that has rows. Each
row: `HoldingLogo` (the name's monogram when `logoUrl` is null), name and ticker, the change as a
`Delta` percentage and the move on the position (`valueChangeEur`, signed, in ink). The subtitle
is "<date> vs <previousDate>". Null dates or two empty lists give a quiet line; a failed request
an `ErrorState` with retry.

### Key files

- `frontend/src/pages/dashboard/MoversCard.tsx`
- `controller/DashboardController.java` — `GET /api/dashboard/movers`
- `service/DashboardMoversService.java` — perimeter, merge, comparison
- `dto/MoversResponse.java`
- `repository/PriceSnapshotRepository.java` — `findRecentByTickers`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Read `price_snapshot` only | No provider call on a dashboard render; the scheduler and price refreshes already write one row per ticker per day | Live quote vs previous close from Yahoo (network on every load, nothing for crypto) |
| Per-ticker latest two days | Crypto is priced every day, listed shares only on refresh days; one global pair of dates would drop one side | Comparing every ticker on the same two calendar days |
| 10-day lookback | A ticker no longer priced drops out instead of showing a month-old move | Unbounded "two latest rows ever" |
| Stored logos only | `storedUrls` is one query; CoinGecko logos are a network call | Calling `CryptoLogoService` on render |

## Gotchas / Pitfalls

- A listed security priced on a weekend gets a Saturday row equal to Friday's close, so on
  Sunday it moves 0 % and is in neither list. Crypto keeps moving.
- `date` / `previousDate` summarise the compared lines; a line can compare other days (a share
  last priced on Friday next to crypto priced today).
- `name` falls back to the ticker when no holding row carries a name.
- Fund codes that no provider prices (Amundi, CMES) never get snapshots and never appear.

## Tests

- `DashboardMoversServiceTest` — merge across accounts with shares, single-snapshot ticker
  ignored, gainers/losers split and order, limit clamp, null dates, explicit nulls in JSON,
  non-investment / hidden accounts excluded.

## Links

- [overview-dashboard.md](./overview-dashboard.md), [price-service.md](./price-service.md),
  [holding-logos.md](./holding-logos.md), [account-ownership-shares.md](./account-ownership-shares.md)
