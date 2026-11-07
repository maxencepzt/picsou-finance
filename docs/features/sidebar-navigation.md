# Feature: Navigation (sidebar, top bar, mobile bar)

> Last updated: 2026-11-03

## Context

Navigation adapts to screen size: a sidebar plus a top bar on desktop (≥ 768px), a floating bottom bar on mobile. Since the "Coffre Nocturne" redesign (ADR `2026-11-03-coffre-nocturne-dark-first-redesign.md`) the sidebar has eight destinations in compact rows, the top bar carries the search, the Me/Household scope, the sync status, the privacy eye and the Sync button on every page, and the mobile bar has five labelled entries.

## How it works

### Destinations: `sidebar-nav-items.ts`

One registry for both bars: `NAV_ITEMS` (Overview `/`, Accounts, Investments, Passive income, Budget, Property & loans, Goals, Analysis), `FAMILY_NAV_ITEM`, `SYNC_NAV_ITEM`, `CLASSIC_SETTINGS_NAV_ITEM`, and `isNavActive(pathname, path)` (the root matches only itself, others match themselves and their sub-paths). The search palette lists the same entries.

### Desktop sidebar: `AppSidebar` (`hidden md:flex`)

A full-height 232px column (`bg-sidebar`, hairline right border): the horizontal logo, then one 40px row per destination (icon + label; the active row is `bg-primary/12` with a blue icon and `aria-current="page"`). Two styles remain (Settings → sidebar style):
- **current** (default): Sync and Settings rows, then the profile row, pinned to the bottom. The profile menu opens above (`side="top"`).
- **classic**: Settings is the last route and the profile row sits right under the list; its menu opens below (`side="bottom"`) and starts with the member's name.

The profile dropdown keeps the admin profile switcher (`useFamilyMembers({ enabled: canSwitchProfile })`, admins only, never in demo), Sync (`/sync`, `aria-current` on that route), Administration (admins) and Sign out (`AccountMenuFooterItems`).

`SidebarStylePromptModal` still asks once which style to use; its miniatures sketch single-line rows and the two profile-row placements.

### Top bar: `AppTopBar`

- **Logo** (mobile only): the horizontal wordmark at 24px, as in the sidebar (the square mark shrank it to an unreadable 28px box).
- **Search field** (desktop) / search icon (mobile): opens the search palette (see `search-palette.md`). The field shows the platform shortcut, ⌘ K on Apple platforms and Ctrl K elsewhere (`lib/platform.ts`).
- **Me / Household**: two links, `/` and `/family`; Household is current on the family view.
- **Sync status** (≥ 1024px): time since the latest automatic sync, or "sync needs attention" when a bank connection failed.
- **Privacy eye** (`PrivacyToggle`): blanks every amount (see `privacy-mode.md`). It moved here from the sidebar.
- **Sync**: opens `SyncAllModal`, now reachable from every page. `AppLayout` mounts the modal only while it is open, because it reads the status of every connector.

### Mobile bar: `MobileBottomNav` (`md:hidden`)

A floating bar (`fixed bottom-4 inset-x-4`) with five entries of at least 44px, icon over label: Overview, Accounts, Invest (`nav.investShort`), Budget, and **More**, which opens a bottom sheet with Passive income, Property & loans, Goals, Analysis, Family, Sync and Settings. More is marked current when the page is one of those.

`AppLayout` still reserves `pb-[calc(5rem+env(safe-area-inset-bottom))]` on `<main>`; `frontend/e2e/mobile-layout.spec.ts` checks the content clears the bar, including with a 34px safe area.

### Key files

- `frontend/src/components/layout/sidebar-nav-items.ts` — destinations and `isNavActive`
- `frontend/src/components/layout/AppSidebar.tsx` — desktop sidebar and profile menu
- `frontend/src/components/layout/AppTopBar.tsx` — top bar, `PrivacyToggle`
- `frontend/src/components/layout/MobileBottomNav.tsx` — mobile bar and More sheet
- `frontend/src/components/layout/AppLayout.tsx` — shell, ⌘K/Ctrl K listener, palette and sync modal
- `frontend/src/lib/platform.ts` — platform detection and the search shortcut

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| One registry for sidebar, mobile bar and palette | A route added once appears everywhere | A private list per surface (the mobile bar used to have one) |
| Family in the top bar (Me/Household) | It is a scope of the same pages, not a ninth destination | A sidebar row |
| Five mobile entries + More | Labels fit and every target is ≥ 44px | Seven icon-only buttons |
| Keep both sidebar styles | The setting existed; the styles now differ only by the Settings and profile placement | Dropping the setting |

## Gotchas / Pitfalls

- **Admin-only members query:** keep `useFamilyMembers({ enabled: canSwitchProfile })`; `/family/members` is admin-only and a 403 redirects the whole app.
- **Babel spread in JSX props:** `{...(condition && { prop: value })}` breaks the build in this project; use a ternary.
- **Lucide icons are stroke icons:** never `fill="currentColor"` on nav icons.
- **`hidden md:flex` on the sidebar:** it needs flex for its column layout.
- **Bottom bar height:** if it changes, update `<main>`'s padding; the e2e spec fails when they drift.
- **The `nav.fixed` selector** in e2e specs targets the mobile bar; the sidebar nav has no `fixed` class.

## Tests

- `AppSidebar.test.tsx` — admin switcher, members query disabled for non-admins, managed-profile filtering, profile invalidation, Sync entry and menu side for both styles.
- `AppTopBar.test.tsx` — search and sync callbacks, Me/Household current state, privacy toggle (state, label, persistence).
- `MobileBottomNav.test.tsx` — five entries, the More sheet (Family, Settings, Sync), More marked current.
- `SidebarStylePromptModal.test.tsx` — each style miniature pinned to its variant: card height, member row placement, gear, Settings position, logo and privacy toggle, two-line rows.
- `lib/platform.test.ts` — Apple detection and the shortcut.
- E2E: `navigation.spec.ts` (routes, labels not clipped at 1440×900 in fr, en, de and es for both styles, ⌘K/Ctrl K), `mobile-layout.spec.ts`.

## Links

- Related ADR: [2026-11-03-coffre-nocturne-dark-first-redesign.md](../decisions/2026-11-03-coffre-nocturne-dark-first-redesign.md)
- Related: `search-palette.md`, `privacy-mode.md`, `demo-mode.md`
