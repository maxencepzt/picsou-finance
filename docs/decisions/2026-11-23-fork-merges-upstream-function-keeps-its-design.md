# ADR: The fork takes upstream's functions and keeps its own design

> Date: 2026-11-23
> Status: ✅ Active

## Context

The maxencepzt fork redesigned the web front ("Coffre Nocturne", see
[the redesign ADR](./2026-11-03-coffre-nocturne-dark-first-redesign.md)): Geist, `lucide-react`
icons, its own account, budget, goals, analysis and sync screens. Upstream's 1.2.1 and 1.2.2
redesigned the same screens another way: Plus Jakarta Sans, Phosphor icons, new paddings, progress
bars, tab bars and page layouts. A plain merge of 1.2.2 conflicted on 165 files, most of them
for visual reasons only, and upstream's 1.2.2 also reused V152, the number of the fork's own
deposit-ceiling migration (already renumbered once, from V142, when merging 1.2.0).

## Decision

1. **Function from upstream, design from the fork.** Each upstream commit is sorted as visual or
   functional. A file whose upstream changes are all visual keeps the fork's version. Functional
   commits and bug fixes are ported onto the fork's screens, in the fork's look; upstream code the
   fork takes is converted from Phosphor to `lucide-react`. `DESIGN.md` stays the fork's.
2. **Fork-only migrations live from V1000 up.** The deposit ceiling moved to
   `V1000__account_deposit_ceiling.sql`; `LegacyMigrationRenumberingCallback` moves its applied
   row from V142 or V152. Upstream's later migrations run out of order (`out-of-order: true`).

## Alternatives considered

### Take upstream's redesign

- **Pros**: smaller future merges; one design with upstream.
- **Cons**: throws away the fork's redesign, which the owner commissioned and documented as the
  authoritative design (`DESIGN.md`, `PRODUCT.md`).

### Keep both icon libraries

- **Pros**: upstream files merge as they are.
- **Cons**: two icon styles on one screen; a second dependency.

### Renumber the fork's migration to the next free number each time

- **Pros**: contiguous numbers.
- **Cons**: collides again at every upstream release, and each move needs another callback row.

## Reasoning

The owner's design is the product's reference; upstream's value for this household is its
connectors, sync fixes and features. Sorting by commit keeps that value without the restyle.
A version range upstream never reaches ends the migration collisions for good.

## Trade-offs accepted

- Every upstream merge needs the same sort, and functional changes written on upstream's markup
  must be re-expressed on the fork's.
- Upstream features tied to its redesign are left out: the "What's new" card and dialog, the
  update check in Settings (it points at upstream's releases and image), the profile photo, the
  design guardrail test and the BNP step of the setup wizard (the backend does not accept it).
- The fork keeps the goals' "on track / behind" status that upstream removed in 1.2.2.

## Consequences

- `docs/conventions/database.md` states the V1000 rule.
- `frontend/package.json` keeps `lucide-react` and `@fontsource-variable/geist`, without
  `@phosphor-icons/react` and `@fontsource-variable/plus-jakarta-sans`.
