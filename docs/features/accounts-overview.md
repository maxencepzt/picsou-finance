# Feature: Accounts Overview (KPI row + grouped account rows + side panel + breakdown + PnL chart + filters) and the account detail page

> Last updated: 2026-11-03

## Context

The Accounts page (`/accounts`) lists every account as a compact row, grouped by asset class. Users need a visual overview of PnL evolution over time, with the ability to filter by asset type (stocks, savings, crypto, etc.). A KPI row covers every account; a total card beside the list shows the balance and PnL of the current filter.

## How it works

### Page layout

Since the "Coffre Nocturne" redesign, `AccountsPage.tsx` shows, top to bottom: the savings
suggestions banner (a neutral card with an icon and a "Configure" button — not a green fill, since
gain green is for movement only), a KPI row (`KpiTile` ×4 from `accountKpis`: gross assets with net worth,
debts, accounts tracked with the manual count, synced accounts refreshed within a day), the
filter strip, then a 12-column grid — the grouped rows on the left (7 columns), the total card,
the asset-class breakdown and the PnL chart on the right (5 columns). The filter strip is wrapped in
a plain `div`: `ScrollStrip`'s own `-m-1` (room for the focus ring) otherwise overrides the
`space-y-6` margin and glues the strip to the cards below it.

The list card has a header — the number of accounts in the current filter as its title, the
grouping switch on the right.

`groupByAssetClass` (`pages/accounts/account-groups.ts`) groups the top-level accounts by
`assetClassOf(type)` in the palette's order, liabilities last under "Debts"; each group header
shows the class colour and the group total, and rows inside a group are sorted by absolute
balance, largest first. A wallet's pockets render as nested rows under it and count only
through the wallet's balance. `signedBalance` reads a `LOAN` (stored positive) and a card debt
(stored negative) both as negative.

### Grouping by asset class or by institution

A `SegmentedControl` at the top of the list card switches the grouping (local state, default
asset class). `groupByInstitution` groups the same items by `provider` (trimmed, compared
lower-cased, spelled as the first account of the group spells it), banks by net total
descending, then the accounts that name no institution ("Manual") and the properties
(`REAL_ESTATE`) in their own bucket. A manual account that names its bank — a loan typed in by
hand — stays with that bank: the view answers "what do I have where". Institution headers carry
no colour dot, since colour belongs to the asset class. Both groupings share `bucket()` (wallet
counts once, largest row first).

### Breakdown by asset class

A `Breakdown` card (bar by default, `lib/asset-classes.ts` colours) over the filtered top-level
accounts: `sumBy(..., assetClassOf, ASSET_CLASS_ORDER)` drops liabilities and empty classes,
largest first. Hidden when nothing is left (the Debts filter).

### Account side panel

Clicking a row (or a pocket) opens `AccountPanel` (`pages/accounts/AccountPanel.tsx`), a right
`Sheet` (full width on a phone): name, type and provider, the signed balance, the
`BalanceHistoryChart` of `useAccountHistory`, the positions for a `HOLDING_ACCOUNT_TYPES` account
(`PositionsByProduct` or a read-only `HoldingsTable`, as on the detail page), the five latest
transactions (`TransactionRow`, dated), then a "View details" link to `/accounts/:id` beside
"Edit" and "Delete" (no delete for a pocket). Edit and delete close the panel first, then open the
edit form or the delete confirmation. The header shows the account's mark (`AccountMark`). It
reads the detail page's own hooks, so the detail page opens from the cache.

### Edit deep link

The edit form and its save logic (account, then a loan's debt details) live in
`AccountEditDialog` (`pages/accounts/AccountEditDialog.tsx`), shared by this page and the account
detail page. `/accounts?edit=<id>` opens that account's edit form: the open form *is* the URL parameter —
`editingAccount` is derived from `?edit` and the account list, the edit button sets it and closing
the form removes it (both `replace`). An unknown id opens nothing. Query structural sharing keeps
the account object stable across refetches, so `AccountForm`'s reset-on-`defaultValues` does not
wipe what the user is typing unless the account itself changed on the server.

### Account row anatomy

`AccountRow` (`pages/accounts/AccountRow.tsx`) renders every account to the same one-line shape:

| Slot | Bank / broker / crypto account | Property (`REAL_ESTATE`) |
|---|---|---|
| Mark (`AccountMark`) | `logoKeyUrl(logoKey) ?? logoUrl ?? providerLogoUrl(provider)`, else the monogram of the name (`deriveMonogram`) — see [bank-logos.md](./bank-logos.md) | the glyph of its `propertyKind` from `PROPERTY_KIND_ICONS` on a muted square |
| Name | `name` + co-ownership share (only below 100 %) | same |
| Subtitle | freshness dot · `provider` · time since `lastSyncedAt` (plus the borrowed amount for a `LOAN`) | freshness dot · property kind and city · time since `realEstate.lastValuedAt` |
| Balance | `signedBalance(account)` | same |
| Actions | edit and delete in a fixed `w-16` column, shown on hover, on keyboard focus and always on touch screens; a pocket has no delete; below `sm` the column is not rendered and both actions live in the side panel | same |

There is no type badge and no "N sub-accounts" label any more: the group header says the class,
and the nested rows say the pockets.

The actions column has a fixed width (whether or not the row has a delete button) and the group
header reserves the same `w-16` (`hidden sm:block`), so every balance — wallet, pocket and group
total — ends on the same vertical line. On a phone the column goes away entirely, which gives the
name back ~70px and avoids two 28px touch targets per row.

A property is a manual account: it has no `provider` and nothing ever writes its
`lastSyncedAt`, so its kind, city and valuation date fill those slots. The unrealised gain lives
on the account detail page and on the Property & loans page ([real-estate-page.md](./real-estate-page.md)).

Every slot is still conditional — an account with no provider and no sync date (a manual
`OTHER` account, or a property described but never valued) renders a short subtitle.

The freshness dot is colour-graded by age, so how old a figure is reads at a glance instead
of only crossing one 48h threshold. `freshnessLevel(date, bounds, now)`
(`frontend/src/lib/utils.ts`) buckets the age against a bounds object; `FRESHNESS_TEXT_CLASS`
maps the bucket to a movement token (`text-gain`, `text-warning`, `text-loss`), and the row's
`DOT_CLASS` matches it.

**Two scales, because the two dates are produced on entirely different cadences** — a scale
that cries wolf is one users learn to ignore:

| Level | `lastSyncedAt` (daily jobs) | `lastValuedAt` (monthly job) | Token |
|---|---|---|---|
| `fresh` | < 24 h | < 35 d | `gain` |
| `recent` | < 48 h | < 60 d | `warning` |
| `stale` | < 7 d | < 90 d | `warning` |
| `old` | beyond | beyond | `loss` |

Both live in `frontend/src/lib/constants.ts` as `SYNC_FRESHNESS_BOUNDS_MS` and
`VALUATION_FRESHNESS_BOUNDS_MS`. The valuation scale is month-shaped because
`SchedulerService.monthlyPropertyValuation` runs on the 1st of each month against sources that
themselves refresh twice a year: a 40-day-old estimate is the system working as designed, and
would be permanently red on the sync scale.

The stale warning (`TriangleAlert` + `accounts.syncStale`, with the `accounts.syncStaleTooltip`
tooltip) is **narrower than the colour**: it replaces the time-ago text only on the
`stale`/`old` levels *and* only for non-manual accounts. Colour alone carries no meaning for
a colour-blind reader, so the worst levels need a second signal — but the tooltip names a dead
provider session and tells the user to reconnect, which is meaningless for a figure they type in
themselves. A manual account still gets the colour, since age is age.

A missing date is `unknown`, not `old`: never synced is not the same as very stale, and must not
read as an alarm. In a row the dot is simply not rendered in that case.

`now` is read once by the page (`useState(() => Date.now())`) and passed to every row and to
`accountKpis`, and it is a parameter of `freshnessLevel` rather than a `Date.now()` call inside
it, which keeps the helper pure and its tests free of fake timers. The grades are therefore those
of the page's mount time.

The glyphs come from `frontend/src/lib/property-icons.ts` (`PROPERTY_KIND_ICONS`), which
`AddPropertyModal`'s kind picker shares so a property looks the same wherever it is shown.
They are keyed on `RealEstateMetadata.propertyKind` — the backend's `PropertyKind.parse` of
the free-text `property_type` column — never on the raw string.

### Account detail page (`/accounts/:id`)

`AccountDetailPage.tsx`, top to bottom:

1. **Header** — a "Comptes" back link, the account mark (`AccountMark size="lg"`: logo, monogram
   or property glyph), the name, then type · institution (a property: kind · city), "Manual" for a
   hand-kept account, and the freshness from `accountFreshness` (`account-groups.ts`, shared with
   the row): a dot and "Synced 3 hours ago", "Last valuation: …" for a property, or the stale
   warning with its tooltip. On a phone the freshness takes its own line. Actions on the right:
   "Monthly statements" (`MonthEndBalanceModal`), "Edit" (`AccountEditDialog`, owners only) and an
   export icon button (`ExportAccountsModal` with this one account; hidden in demo mode, which has
   no export handler). There is no per-account sync: the top bar's Sync covers it.
2. **Hero row** — a card with the balance in display size and one `Delta`, plus the figures that
   matter for the type; beside it (from `xl`) the value chart. The hero is a container: beside the
   chart its figures sit under the balance (hairline between, two columns); full width they sit to
   its right, one column per figure.

   | Type | Label | Delta | Figures |
   |---|---|---|---|
   | Holdings (`HOLDING_ACCOUNT_TYPES`) | Portfolio value | unrealised P&L (amount, %) when the basis is known | capital invested, cash / euro fund, positions, opening date |
   | `CREDIT_CARD` | Card debt | month change | amount due, due date, card type, miles |
   | `LOAN` | Remaining capital | month change, inverted (a falling debt is good news) | borrowed, monthly payment, rate, end date |
   | `REAL_ESTATE` | Current value | gain since purchase (when there is a cost basis) | cost basis, living area |
   | `SCPI` | Current balance | month change | shares, withdrawal price, subscription price, distribution per share |
   | configured livret | Current balance | month change | annual rate, ceiling (with the share used), projected interest of the year (`useSavingsInterest`, its own component so the query mounts only there) |

   A co-owned account adds "Your share". The **month change** is `monthChange(history)`: the latest
   snapshot against the last one dated a calendar month or more before it; it is left out when the
   history is shorter or the account is not in euros (snapshots are in the account's currency).
   The chart is `NetWorthChart` (value and capital invested) for holdings, the property's
   `PropertyValuationChart` (falls back to the balance history below two estimates), else
   `BalanceHistoryChart`; a loan has none here.
3. **Type sections** — `LoanDetailSection` (amortisation curve beside a progress card that also
   splits one monthly payment into capital / interest / insurance on the chart ramp, then the cost
   summary as three tiles), `PropertyDetailSection` (characteristics, valuation, financing and
   ownership as a two-column grid), `ScpiDetailSection` (dividend policy, schedule, identifiers and
   provider links — the share count and prices are in the hero).
4. Upcoming dividends (`COMPTE_TITRES`, `PEA`), positions and realised P&L for holdings.
5. **Activity** — transactions (8 columns) beside the ten latest snapshots (4 columns) from `xl`;
   for a savings account they sit in the "Overview" tab next to the livret configuration.

### Sorting the position tables

Every column of the three tables on the account detail page — `HoldingsTable`,
`PositionsByProduct` and `RealizedPnlSection` — is a sort key. `useTableSort`
(`frontend/src/hooks/use-table-sort.ts`) holds the state locally, per the
[UI-filter ADR](../decisions/2026-04-05-component-local-state-for-ui-filters.md), and
`SortableTableHead` wraps the shadcn `TableHead` rather than editing it.

Three rules the comparator carries, each of which was a way to get this wrong:

- **Nulls sink to the bottom in both directions.** A dash means "we could not price this line",
  not zero — the same distinction `PositionsByProduct` already makes when it refuses to publish a
  subtotal over an unpriced row. Ordering null as the smallest value would float the lines we know
  least about to the top of an ascending sort.
- **The sort is stable and never in place.** Rows that tie keep the order the API sent them in, so
  sorting on a column that is empty for every visible row is a no-op rather than a shuffle.
- **Text compares through an `Intl.Collator`.** "Élan" starts at U+00C9, above `Z` in code-point
  order; a raw `<` would file every accented fund name after "Zeta".

The default is **value, descending** — the biggest line first is what the reader is nearly always
after. `PositionsByProduct` keeps **one** sort for its three product sections and applies it inside
each: the SPOT/STAKING/LENDING sequence is editorial, not data, and survives any column picked.

`AccountDetailPage` passes `key={accountId}` to all three, which is what resets the sort when the
reader moves to another account — React Router keeps the same component across a change of `:id`,
so without the key a sort chosen on one portfolio would silently carry over to the next.

### Opening date

`account.opened_at` (V91) records when a wrapper was opened, as the member states it. The account
form offers it for the types whose taxation turns on the plan's age — `PEA`, `ASSURANCE_VIE` and
`PER`, listed in `OPENING_DATE_TYPES` — and the xlsx export prints it under the account's type.

**It is not `created_at`.** That column dates the Picsou row; a PEA opened in 2014 and typed in
last month has ten years between the two, and the ten years are the point. Nothing backfills it
for the same reason: no existing row can know its own opening date, and deriving one from
`created_at` would put a fabricated fiscal anniversary in an export.

**A null in `AccountRequest.openedAt` means "leave it alone", not "clear it"** — the same rule
`logoKey` carries, and for the same reason: the MCP `update_account` tool has no such parameter
and sends null on every call, so treating it as a clear would wipe the date the first time an
agent renamed the account. The cost is that the form can change the date but not blank it.

The column is deliberately general rather than `pea_opened_at`: a PER, a PEA-PME and an
assurance-vie all have the same shape of rule at different thresholds. Extending the field to
another type is one entry in `OPENING_DATE_TYPES`.

### Total card

A `Card` beside the account list shows the total balance for the filtered accounts. When the filter
holds anything with a cost basis distinct from its value, it also displays the aggregate PnL as a
`Delta` (signed amount, percentage and arrow).

That test is `hasPnl`, and it covers two different sources of a basis:

- **an investment account** — `HOLDING_ACCOUNT_TYPES` (PEA, COMPTE_TITRES, CRYPTO,
  EMPLOYEE_SAVINGS, ASSURANCE_VIE, PER), whose basis is the sum of its holdings' cost
- **a property** — `hasMeasurableGain(account)`, i.e. a `REAL_ESTATE` account whose
  `realEstate.costBasis` is positive

Cash-only filters (SAVINGS, CHECKING) are still excluded: their PnL is 0 by construction.

#### Where a property's gain comes from

A property holds nothing, so `AccountService.valuation()` falls back to
`invested = currentBalance` and the snapshot's `pnl` is structurally 0 — the Immobilier filter
showed a total and no gain line for exactly that reason. Its real basis is the purchase price plus
every acquisition fee, already on the wire as `RealEstateMetadataResponse.costBasis`, and already
what `PropertyValuationChart` measures against.

`frontend/src/features/accounts/pnl.ts` substitutes it. Two pure helpers, used by the total card
*and* both branches of the chart so the three cannot drift apart:

| | `accountInvestedAt` | `accountPnlAt` |
|---|---|---|
| not `REAL_ESTATE` | `point.invested` | `point.pnl` |
| property, basis > 0 | `costBasis` | `point.total - costBasis` |
| property, no basis | `point.total` | `0` |

The third row is the one that matters. A property described but never given a purchase price
contributes its own balance to the denominator, so it reports no gain. Leaving it out of the
denominator while its balance stayed in the numerator is the partial-basis mismatch
`AccountService.valuation()`'s javadoc warns about — it would report a gain the size of the whole
property.

This is a **frontend-only** substitution, on purpose. Making `calculateInvestedAmount` return the
cost basis for a property would be the tidier fix, but existing `balance_snapshots` rows carry
`invested = balance` for properties, so the curve would step at the deployment date — and it would
silently move the dashboard's net-worth PnL too.

### PnL line chart

The `AccountsStackedChart` renders a Recharts `LineChart` (not stacked — PnL can be negative). Each line represents one category or account's PnL (`balance - invested`) over time.

Data preparation depends on the active filter:

- **ALL filter**: PnL is aggregated by asset type group (one line per group: STOCKS, CRYPTO, etc.).
- **Specific filter** (e.g. STOCKS): PnL is computed per individual account.

The chart is rendered on the same `hasPnl` test as the summary line, so the Immobilier filter now
draws a curve too: historical balance minus a constant cost basis, over real data — the daily
snapshot job already records the balance `PropertyValuationService` writes each month. For cash-only
filters (SAVINGS, CHECKING) the chart stays hidden, since PnL is always 0.

Both branches of `chartPnlData` group by **account object**, not by id string, because a property's
PnL is only computable from the account itself — that is where its cost basis lives.

### Asset type filters

Seven asset categories (plus ALL) defined in `AccountsPage.tsx`:

| Filter key | Account types | Chart color |
|-----------|--------------|-------------|
| STOCKS | PEA, COMPTE_TITRES, EMPLOYEE_SAVINGS, ASSURANCE_VIE, PER | `#6366f1` |
| METALS | OTHER | `#eab308` |
| SAVINGS | LEP, LIVRET_A, LDDS, LIVRET_JEUNE, PEL, CEL, SAVINGS | `#22c55e` |
| CHECKING | CHECKING | `#0ea5e9` |
| CRYPTO | CRYPTO | `#f97316` |
| REAL_ESTATE | REAL_ESTATE, SCPI | `#a855f7` |
| DEBTS | `LIABILITY_ACCOUNT_TYPES` (LOAN, CREDIT_CARD) | `#ef4444` |

The filter affects the total card, the chart and the account rows simultaneously; the KPI row
always covers every top-level account.

### History fetching

`useHistory(allAccountIds, 12, true)` (`features/history/hooks.ts`) calls `GET /history` once for
every non-pocket account in split mode: each `NetWorthPoint` carries an `accounts` map of
`{ total, invested, pnl }` per account id, which the total card and both chart branches read.

### Key files

- `frontend/src/components/shared/AccountForm.tsx` — `OPENING_DATE_TYPES` and the date field
- `backend/src/main/resources/db/migration/V91__account_opened_at.sql`
- `frontend/src/pages/accounts/AccountsPage.tsx` — page: KPI row, filters, grouped rows, total card, PnL chart
- `frontend/src/pages/accounts/AccountRow.tsx` — one row; `AccountMark`
- `frontend/src/pages/accounts/AccountPanel.tsx` — the side panel
- `frontend/src/pages/accounts/AccountEditDialog.tsx` — the edit form and its save, shared with the detail page
- `frontend/src/pages/accounts/AccountDetailPage.tsx` — the detail page
- `frontend/src/pages/accounts/account-groups.ts` — `signedBalance`, `groupByAssetClass`, `groupByInstitution`, `accountKpis`, `accountFreshness`, `monthChange`
- `frontend/src/lib/property-icons.ts` — `PROPERTY_KIND_ICONS`, shared with `AddPropertyModal`
- `frontend/src/components/shared/AccountsStackedChart.tsx` — PnL line chart component
- `frontend/src/features/history/hooks.ts` — `useHistory` (split mode)
- `frontend/src/demo/index.ts` — mock history data (12 months per account)

### Flow

```
AccountsPage
  ├─ useAccounts() + useAccountTree() → top-level accounts, wallets and their pockets
  ├─ useHistory(ids, 12, split=true)  → per-account points
  │
  ├─ accountKpis(...)                 → KPI row (all top-level accounts)
  ├─ filteredNonPockets (useMemo)     → accounts matching current filter
  ├─ groupByAssetClass(...)           → grouped AccountRow list (pockets nested)
  ├─ hasPnl                           → an investment account or a property with a basis
  │
  ├─ Total card (totalBalance + PnL)
  │
  ├─ chartPnlData (useMemo)
  │   ├─ ALL  → aggregate PnL per type group per date
  │   └─ else → PnL per individual account per date
  │
  └─ <AccountsStackedChart> (only if hasPnl)
```

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Virtual `Account` objects for type groups in ALL mode | `AccountsStackedChart` expects `Account[]` — avoids a second component or prop variant | Separate `GroupedChart` component |
| Client-side PnL computation in `useMemo` | PnL = balance - invested; both already available from the hook | Backend PnL endpoint |
| `LineChart` instead of stacked `AreaChart` | PnL can be negative — stacking breaks with negative values | Stacked areas with clamping |
| Separate `balances` / `invested` arrays from hook | Clean separation — chart consumes computed PnL, not raw data | Single array with `inv_` prefixed keys |
| Forward-fill missing balance and invested values | Accounts may not have snapshots for every date; chart needs continuous data | Interpolation (would invent non-real values) |
| Hide chart for cash-only filters | SAVINGS/CHECKING have PnL = 0 — a flat line chart adds no value | Show empty chart with flat zero lines |

## Gotchas / Pitfalls

- **A new `PropertyKind` needs an entry in `PROPERTY_KIND_ICONS`.** The map is typed
  `Record<PropertyKind, LucideIcon>`, so a missing key fails the build rather than silently
  dropping the glyph — but the enum lives in the backend, and adding a value there without
  adding it to `PropertyKind.parse` leaves `propertyKind` null and the row back on the logo or
  monogram mark.
- **`assetClassOf` decides the groups.** A type it maps to `null` (a liability) is filed under
  "Debts". `CLASS_OF` in `lib/asset-classes.ts` is a `Record<AccountType, …>`, so a new type fails
  the build until it is placed.
- **Never derive an account type's label key from its name.** `accountTypeLabelKey()` in `lib/constants.ts` is the only mapping; a local `type.toLowerCase()` renders the raw key (`accountTypes.livret_a`) for any type whose key isn't simply its lowercased value. See [add-account-modal.md](./add-account-modal.md#account-type-labels).
- **`TYPE_TO_GROUP` must cover every `AccountType`** — if a new type is added to the enum but not to this map, those accounts silently disappear from the ALL chart. It is typed `Record<AccountType, string>`, so the compiler catches the omission; `ASSET_FILTER_MAP` is **not** exhaustive by type and needs the same edit by hand.
- **This grouping is not the investment pyramid's.** `WealthTier.of()` answers a different question (the role an asset plays, not how a user browses it) and lives on the backend — see [wealth-pyramid.md](./wealth-pyramid.md). Do not collapse the two without deciding which answer to lose.
- **`HOLDING_ACCOUNT_TYPES` lives in `lib/constants.ts`**, not in this page. It used to be duplicated here, in `AccountDetailPage` and in `features/accounts/hooks.ts`, so a new position-bearing type meant three chances to forget one.
- **`currentBalanceEur` is the account's full value, not the viewer's share.** Co-owned accounts carry `sharePercent` alongside it (see [account-ownership-shares.md](account-ownership-shares.md)); anything summing balances on this page must apply it, because the server only weights its own aggregates.
- **`Account.id` cast to `number`** — virtual group accounts use string keys (`'STOCKS'`, `'CRYPTO'`) cast as `number` via `as unknown as number`. This works because Recharts uses `dataKey` as a string lookup, but it's fragile.
- **`totalInvested` relies on the last invested point** — if an account has no snapshots at all, its invested amount is 0 and PnL equals its full balance. This is correct for newly created accounts where balance = invested.
- **Cash accounts have `investedAmount = balance`** — set by `AccountService.calculateInvestedAmount()` which returns `currentBalance` for accounts without holdings. This means their PnL = 0.
- **Demo mock history** — the `GET /history` handler in `frontend/src/demo/index.ts` builds the points with `netWorthHistory(ids, months, split, …)`. The last point should match the account's `currentBalance` to stay consistent.

## Tests

- `frontend/src/pages/accounts/AccountRow.test.tsx` — the monogram without a logo, the logo
  order (connector, bundled, connector over bundled, own key over everything, provider when the
  key has no asset), one glyph per property kind (matched on lucide's `lucide-<icon>` class),
  kind and city standing in for the provider, the stale warning on a synced account not
  refreshed for days, none on a recent sync or a manual account.
- `frontend/src/pages/accounts/account-groups.test.ts` — group order with debts last and summed
  negative; institutions netted and ordered, a hand-typed loan kept with its bank, the manual and
  property buckets last; the KPI split of assets and debts and the count of synced accounts
  refreshed within a day; `monthChange` (month-end and January dates, too-short history, no
  percent from zero) and `accountFreshness` (valuation scale for a property, no warning on a manual
  account).
- `frontend/src/pages/accounts/AccountDetailPage.test.tsx` and
  `AccountDetailPage.duplicateSections.test.tsx` — the PER euro-fund figure without an implied
  zero P&L, one holdings card and one realised P&L section, dividends only on a CTO or PEA.
- `frontend/src/pages/accounts/AccountsPage.test.tsx` — the property gain against its cost basis,
  the PnL chart on the Immobilier filter, partial bases, the row actions visible on touch screens,
  the grouping switch, a row opening the panel, `?edit=<id>` opening and clearing, an unknown id.
- `e2e/accounts.spec.ts` — the panel from a row and its link to the detail page, the `?edit=`
  deep link opening and clearing, an unknown id.
- `frontend/src/hooks/use-table-sort.test.ts` — direction flips, a new column starting at its
  natural direction, nulls last both ways, collator ordering, stability, and that the caller's
  array is never mutated.
- `HoldingsTable.test.tsx` — opens on the largest position, a column flips, ticker sorts
  alphabetically while P&L sorts numerically, an unpriced line stays at the bottom either way, and
  `aria-sort` follows the active column. `PositionsByProduct.test.tsx` adds the one-sort-three-
  sections case.
- `AccountsWorkbookServiceTest` — the opening date is written on the account sheet, and the line
  is absent rather than blank when none is stated.

## Links

- i18n keys: `accounts.pnl`, `accounts.total`, `accounts.filters.*`, `accounts.groupBy.*`,
  `accounts.breakdown.*`, `accounts.panel.*`, `accounts.lastSync`,
  `accounts.lastValuation`, `property.kind.*`, `dashboard.netWorthChange`
- Related: [dashboard-time-range-isolation.md](./dashboard-time-range-isolation.md) — Dashboard PnL chart
- Related: [live-prices-holdings.md](./live-prices-holdings.md) — per-holding PnL calculation
- Related: [bank-logos.md](./bank-logos.md) — the row's mark (bank logo, falls back to the monogram)
- Related: [real-estate-valuation.md](./real-estate-valuation.md) — where `propertyKind` and `lastValuedAt` come from
