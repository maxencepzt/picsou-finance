# Feature: Spending by merchant

> Last updated: 2026-11-03

## Context

The spending breakdown ranked expenses by category only. "Where does the money go?" is just as
often answered by a shop name. This endpoint ranks the same expenses by merchant.

## How it works

`GET /api/spending/by-merchant?period=CYCLE&anchor=2026-11-03&limit=10` (`limit` clamped to 1..25).

`CashflowFlowService.spendingByMerchant` uses the same two private helpers as
`spendingByCategory`:

- `range(memberId, period, anchor)` — the pay cycle containing the anchor, or Jan 1 → anchor for
  `YTD` (see [budget.md](./budget.md));
- `expenses(memberId, range)` — `findByMemberIdAndDateBetween` (owned, non-hidden accounts), minus
  transfer-kind categories and every non-negative amount. Both breakdowns read this one helper,
  so the by-merchant `total` always equals the by-category `totalExpense`.

Merchant identity, first match wins:

1. `merchantBrandId` → key `brand:<id>`; label and logo domain from `MerchantKnowledgeBase`
   (falls back to the row's `merchantLabel` when the id is no longer in the base);
2. `merchantLabel` → key `label:<MerchantNormalizer.matchKey(label)>` (lower-case, accents and
   apostrophes stripped);
3. otherwise `MerchantNormalizer.normalize(counterparty, description)` — the categorizer's own
   cleaning ("CB SNCF 1234 01/02" → "Sncf") — under the same `label:` key.

A label row and a counterparty row that clean to the same key are one merchant; the first row
seen gives the label. Amounts are positive; `share = amount / total × 100` (2 dp, a percentage,
unlike the by-category fraction); sorted by amount desc then key; `total` covers every expense,
listed or not.

`logoUrl` is `/api/merchants/<id>/logo` — the proxy `MerchantAvatar` already uses — only for a
brand with a logo domain and when the member enabled logo fetching
(`BudgetSettingsService.logoFetchEnabled`); otherwise null.

```json
{ "from": "2026-10-25", "to": "2026-11-24", "total": 1834.2,
  "merchants": [{ "key": "brand:12", "label": "Carrefour", "logoUrl": null,
                  "amount": 412.3, "count": 7, "share": 22.48 }] }
```

### Frontend

`budgetApi.getSpendingByMerchant` + `useSpendingByMerchant(period, anchor, limit)`
(`features/budget/`, key `['budget', 'spending', 'merchants', …]`, so the by-category
invalidations reach it). `pages/budget/TopMerchantsCard.tsx` on the budget overview asks for the
displayed cycle's top six: logo (`logoUrl`) or monogram via `MerchantAvatar`, amount, purchase
count and a share bar; `total` minus the listed amounts is the "other merchants" line. See
[budget.md](./budget.md#overview-coffre-nocturne-redesign).

### Key files

- `controller/SpendingController.java` — `GET /api/spending/by-merchant`
- `service/budget/CashflowFlowService.java` — `spendingByMerchant`, shared `range` / `expenses`
- `service/budget/MerchantNormalizer.java`, `service/budget/MerchantKnowledgeBase.java`
- `dto/MerchantSpendingResponse.java`
- `frontend/src/pages/budget/TopMerchantsCard.tsx` — the overview card

## Technical choices

| Choice | Why | Rejected alternative |
|--------|-----|----------------------|
| One `expenses` helper for both breakdowns | Totals cannot drift between the two views | A copy of the filter in the new method |
| `matchKey` of the label as identity | Casing and accents differ between banks for the same shop | Raw `merchantLabel` |
| Description as the last fallback | It is what `merchantLabel` itself is derived from when the counterparty is blank | An "unknown" bucket |

## Gotchas / Pitfalls

- Exclusions are exactly by-category's: transfer-kind categories and credits. A purchase of
  securities booked as an uncategorised debit counts as spend in both views.
- A refund (a credit) is excluded, not netted against the merchant's spend.
- Two brands sharing a display name stay two rows (different ids).
- A row with blank label, counterparty and description lands under the key `label:` with an
  empty label.

## Tests

- `CashflowFlowServiceTest` (`spendingByMerchant_*`) — brand vs label vs counterparty vs
  description keys, normalisation merge, percent shares, logo opt-in, exclusions identical to
  by-category, limit clamp with the full total, YTD window.

## Links

- [budget.md](./budget.md), [ai-categorization.md](./ai-categorization.md)
