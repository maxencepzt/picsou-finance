# Feature: Search palette (⌘K / Ctrl K)

> Last updated: 2026-11-03

## Context

With eight destinations, dozens of accounts and positions, jumping straight to one should not take three clicks. The palette opens from the top-bar search field or from the keyboard, on any page, and searches accounts, securities, pages and quick actions.

## How it works

- `AppLayout` listens to `keydown` on `window` and toggles the palette when `isSearchShortcut(event)` is true: ⌘K on Apple platforms (`metaKey`), Ctrl+K elsewhere (`ctrlKey`), no Alt/Shift.
- `lib/platform.ts` detects Apple platforms from `navigator.userAgentData.platform`, then `navigator.platform`, then the user agent. `modifierKeyLabel()` prints `⌘` or `Ctrl`; the top-bar field and the palette footer show the shortcut of the user's own platform.
- `CommandPalette` is a `Dialog` whose body mounts only while open (fresh query and selection each time). Data comes from the cached `useAccounts()` and `usePortfolio()` queries.
- Empty query: quick actions (sync all, hide/show amounts, settings) then pages. With a query: securities (≤ 5), accounts (≤ 5), actions, pages, matched on name and hint after `normalizeSearch` (lower case, accents stripped: "epargne" finds "Épargne").
- Keyboard: ↑/↓ move the highlight (wrapping), Enter runs it, Esc closes (Radix). The input is a `combobox` with `aria-activedescendant`; results are `option`s grouped under labelled `group`s, in the same order as the keyboard walks them.
- Amounts go through `CurrencyDisplay`, so privacy mode masks them here too.

### Key files

- `frontend/src/components/layout/CommandPalette.tsx` — the palette
- `frontend/src/components/layout/AppLayout.tsx` — shortcut listener, open state
- `frontend/src/lib/platform.ts` — platform detection, label, shortcut matcher
- `frontend/src/components/shared/Kbd.tsx` — keycaps
- `frontend/src/lib/utils.ts` — `normalizeSearch`

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| Hand-written list on the existing Dialog | A few dozen items, no new dependency | `cmdk` |
| Search cached queries client-side | Accounts and positions are already loaded by the app | A search endpoint |
| Shortcut label from the platform | Windows users press Ctrl, not ⌘ | A hard-coded "⌘K" |

## Gotchas / Pitfalls

- The item order in `items` must match the displayed group order, or the arrow keys jump around.
- The listener toggles: pressing the shortcut again closes the palette.

## Tests

- `CommandPalette.test.tsx` — default list, accent-insensitive matching, Enter navigates and closes, arrow keys wrap.
- `lib/platform.test.ts` — detection and the shortcut matcher.
- E2E `navigation.spec.ts` — `ControlOrMeta+k` opens it and Enter navigates.

## Links

- Related: `sidebar-navigation.md`, `privacy-mode.md`
