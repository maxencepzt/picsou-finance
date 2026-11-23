# Feature: Account list display order and collapse (Tout tab)

> Last updated: 2026-11-23

## Context

With many accounts, the `/accounts` "Tout" list gets long. The ask: reorder accounts
with simple controls and fold away rarely-checked ones — without touching any figure.
This is deliberately **not** the `hidden` flag ([account-visibility.md](./account-visibility.md)):
`hidden` excludes the account from the dashboard, wealth pyramid, budget and cashflow.
Collapsing here hides only the card in the Tout list; the account stays in every total,
budget and chart. First iteration uses up/down arrows (no drag-and-drop — to be
discussed with the community first).

## How it works

### Data model

One row per (member, account) in `account_display_pref` (`V152__account_list_display.sql`),
with a unique constraint on `(account_id, member_id)` and cascading deletes on both sides.
Absence of a row means defaults (natural order, shown). Rows may reference any account
the member can read — owned or shared — so every viewer arranges their own view without
affecting anyone else's. Like `hidden`, this is display-only: a collapsed account keeps
syncing, exporting, and counting in every total, budget and chart.

### Backend

- `PUT /api/accounts/display-order` `{ accountIds: [...] }` — applies the member's own
  order: listed accounts take positions `0..n`. Rows of accounts absent from a
  non-empty payload are left untouched (a collapsed or hidden account keeps its
  position and finds it again when shown); only an explicit empty list clears all
  positions. A null list is rejected (`400`). Unknown and duplicate ids fail the whole
  update (nothing is saved). Any readable account — owned or shared — can be arranged;
  prefs never leak from one viewer to another. Concurrent first writes merge atomically
  (upsert), so no double click can 500. Positions are one global number space, applied
  by the list UI *within each section* (wallet groups, then standalone accounts): v1 does
  not move cards across sections.
- `PUT /api/accounts/{id}/display` `{ collapsed: bool }` — same readable guard; collapses
  only the caller's own view of a shared account, never anyone else's. The write merges
  atomically (upsert), like the order endpoint.

### Frontend (Tout tab only)

- A "Réorganiser" toggle shows per-card up/down arrows plus a collapse eye; moves and
  collapse flips persist immediately as the viewer's own preferences (their phone and PC
  share them; nobody else's view changes). Readable accounts — owned or shared — can all
  be arranged; a position set by one viewer never applies to another.
- Collapsed cards leave the grid and gather in a recap row (count + signed total,
  loans subtracted like the header total) with a "still counted everywhere" note.
- Totals, PnL, the stacked chart and every other tab keep using the unfiltered lists,
  so collapsed accounts never leave a figure. Pockets stay nested under their wallet;
  collapsing a wallet folds the whole group.

**In the maxencepzt fork**, the list is the grouped row list of
[accounts-overview.md](./accounts-overview.md), not a card grid. The "Réorganiser" toggle sits in
the list card's header next to the Class / Institution switch, on "Tout" only. In reorder mode
each top-level row gets up / down arrows (they move a row within its own group, disabled at the
group's ends) and an eye to collapse it; collapsed rows come back dimmed so they can be unfolded.
One saved order serves both groupings: a move takes the row out of the full ordered list and puts
it back next to its neighbour, so no row of the other grouping changes place. Inside a group,
rows with a `listPosition` come first, the rest by largest balance. The recap row closes the
list card, with a "Gérer" link that opens reorder mode; group subtotals cover the rows shown, so
subtotals plus the recap add up to the total.
