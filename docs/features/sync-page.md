# Feature: Sync Page and Sync-All Modal

> Last updated: 2026-11-03

## Context

`/sync` used to be a strip of 22 tabs (one per provider, plus account visibility) wrapping onto three rows, followed by the bank search. It read as a settings dump: nothing said which connections the member has, which ones are broken, or how to add one. The "Synchroniser" modal of the top bar listed the same connections as oversized cards with inconsistent badges and no logos. The page is now an overview of the member's connections plus a catalog to add one, and the modal is a compact list grouped by what each connection needs.

## How it works

### /sync — overview

1. **Your connections** (card) — one row per connection: mark (logo, else monogram), name, kind · state · last sync, and the one action its state calls for:
   - a lapsed session, a Trade Republic without session, an unremembered Revolut or a dead bank consent → **Reconnecter** (opens the provider view, with `&reconnect=1` when credentials are stored; a bank restarts its OAuth flow directly);
   - a live connection → **Synchroniser** (in-row spinner, then "Synchronisé" or the error under the row);
   - Finary → none, its import runs from its view.
   The row itself opens the provider view (the chevron). Rows to reconnect come first. The card header has **Tout synchroniser (N)**, N being the rows a click can complete in place.
2. **Add a connection** (card) — `ProviderCatalog`: a search (accent- and case-insensitive on name and description), a category filter (All, Banks, Brokers, Crypto, Employee savings, SCPI, Imports) and the providers as tiles. Choosing one opens its view.
3. **Visible accounts** — a button in the page header (`?tab=visibility`), not a provider tile.

States: **connected** (gain dot), **connected, never synced** (muted dot + "Jamais synchronisé"), **to reconnect** (warning dot and words), **last run failed** (loss dot and words). A last sync older than two days (`SYNC_FRESHNESS_BOUNDS_MS`, levels stale/old) turns warning with an icon.

### /sync?tab=<key> — provider view

A back button ("Synchronisation"), a header (mark, name as the page `h1`, one-line description, the provider's state: not connected / its single connection's state and last sync / "N connexions · M à reconnecter") and the provider's panel as the body, at most 760px wide. Panels render no page header of their own: this frame is the contract the panel components rely on. File imports (Actual, HomeBank) and the visibility view show no state line.

The keys are the former tab keys and must not change: the Sync-all modal, the bank OAuth callback, `?reconnect=1` (CIC) and the e2e specs link to them. `/sync/callback?code=…` (no `tab`) renders the banks view, which completes the OAuth exchange. An unknown key falls back to the overview. Choosing a view pushes a history entry, so the browser Back button returns to the overview, and the view starts scrolled to the top.

### Sync-all modal (top bar)

Header: "Synchroniser les comptes", then "N connexions · Synchro il y a X" (the most recent sync). Body: **À reconnecter** first (Reconnecter → provider view, or Trade Republic's inline phone/PIN/TAN form, or the bank OAuth link; a failed bank also keeps its retry), then **Connectées** (per-row sync with spinner, "Synchronisé" or error in the row; Finary opens its view). Footer: **Tout synchroniser (N)**, which turns into "Synchronisation… done/total" with a thin progress bar while the batch runs. With no connection, it offers to open /sync.

Every behaviour of the previous modal is kept: rows that own a surface (`ownTab`) never sync in place and are left out of the batch; Revolut with remembered credentials syncs in place (discover → auto-confirm with `remember: true, voluntary: false`); TR without a session opens its inline login; a dead TR session found mid-sync opens it too.

### Add-account modal

`AddAccountModal` uses the same `ProviderCatalog`, under two hand-entered choices (manual account first, property). See [add-account-modal.md](./add-account-modal.md).

### Key files

- `frontend/src/pages/sync/SyncPage.tsx` — overview (connections card, catalog card) or provider view, from `?tab=`
- `frontend/src/pages/sync/ProviderView.tsx` — the provider frame and the `?tab=` → panel table (typed on `ViewKey`, so a catalog entry without a panel does not compile)
- `frontend/src/pages/sync/catalog.ts` — the provider catalog: key, labels, category, bundled logo or generic icon; `filterCatalog`, `isViewKey`
- `frontend/src/pages/sync/ProviderCatalog.tsx` — search + category chips + tiles, laid out on its own width (container queries: 1 column on a phone, 2 in the modal, 3 on the page)
- `frontend/src/pages/sync/use-sync-connections.ts` — `useSyncConnections()` (every connection from the status of each connector, with its view key, category and logo) and `useConnectionSync()` (in-place sync of a row or a batch, row errors and successes, bank reconnect); `ownTab`, `needsReconnect`, `connectionState`
- `frontend/src/pages/sync/ConnectionRow.tsx` — the row shared by the page and the modal (`SyncLine`: kind · state · last sync)
- `frontend/src/components/shared/ProviderMark.tsx` — logo on a white tile, else generic icon, else monogram of the capitalised words; also used by the provider panels, `BankPicker` and the add-account modal
- `frontend/src/components/sync/SyncAllModal.tsx` — the modal, on top of the two hooks

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Views keyed by the URL (`?tab=`), pushed on choice | Deep links and the browser Back button work; the old keys stay valid | Local tab state with `?tab=` read once (what the tab strip did) |
| Connection list and sync engine extracted to hooks | The page and the modal show and sync the same rows; one copy of the per-provider rules | Duplicating the modal's 400 lines in the page |
| Catalog grid on container queries | The same component fits the page card, the modal and a phone | Viewport breakpoints, which gave 3 cramped columns inside the modal |
| Monograms for brands without a bundled logo | Only BoursoBank, Amundi, Trade Republic, Meria and the wallet marks ship; generic entries (any bank, any exchange, file imports) take an icon | Generic icons for brands (what the old lists did) |
| "SCPI" category | Only CORUM and Sofidy exist; an "Assurance" label would promise insurers that are not there | "Assurance / SCPI" |

## Gotchas / Pitfalls

- **Never rename a catalog key.** They are the `?tab=` keys; see above.
- **Bank connections carry no logo.** The row takes the `logoUrl` of an account whose `provider` is the institution name.
- **`now` comes from lazy state** in each component that judges freshness (React Compiler purity rule).
- **The batch only counts rows a click can finish in place**; rows to reconnect keep their own button.
- **The Revolut effect sets state inside an effect** with local closures, like the original: routing those calls through the hook's callbacks trips `react-hooks/set-state-in-effect`.

## Tests

- `frontend/src/components/sync/SyncAllModal.test.tsx` — every provider row (listed / hidden / expired → view / live → endpoint), Revolut in-place sync, TR inline auth, batch rules, grouping of rows to reconnect ahead of connected ones
- `frontend/src/components/shared/AddAccountModal.test.tsx` — catalog search and category filter, manual choice first, Actual/HomeBank open their Sync view
- `frontend/e2e/sync.spec.ts` — every provider has a tile, search and category, connection states, view and back, deep link, unknown key
- `frontend/e2e/mobile-layout.spec.ts` — at 360px: category chips on one swipeable row and tiles in one column, nothing clipped on the overview or a view, deep links to CMES and visibility, a half-hidden category chip scrolls into view, the chip focus ring is not cut

## Links

- [Add account modal](./add-account-modal.md), [Bank sync](./bank-sync.md), [Account visibility](./account-visibility.md)
- Related ADR: [Coffre Nocturne redesign](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
