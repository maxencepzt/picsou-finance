import { ASSET_CLASS_ORDER, assetClassOf, type AssetClassKey } from '@/lib/asset-classes'
import { SYNC_FRESHNESS_BOUNDS_MS } from '@/lib/constants'
import { freshnessLevel } from '@/lib/utils'
import type { Account } from '@/types/api'

/** A loan is stored as the positive amount owed, a card debt already negative: both read negative here. */
export function signedBalance(account: Account): number {
  return account.type === 'LOAN' ? -account.currentBalanceEur : account.currentBalanceEur
}

export type AccountGroupKey = AssetClassKey | 'debts'

/** A top-level account and the pockets nested under it (empty for most accounts). */
export interface AccountItem {
  account: Account
  pockets: Account[]
}

export interface AccountGroup {
  key: AccountGroupKey
  total: number
  items: AccountItem[]
}

/**
 * Accounts by asset class in the palette's order, liabilities in their own group last. A wallet's
 * balance already includes its pockets, so only the wallet counts toward the total. Largest first
 * inside a group.
 */
export function groupByAssetClass(items: AccountItem[]): AccountGroup[] {
  const groups = new Map<AccountGroupKey, AccountGroup>()
  for (const item of items) {
    const key = assetClassOf(item.account.type) ?? 'debts'
    const group = groups.get(key) ?? { key, total: 0, items: [] }
    group.items.push(item)
    group.total += signedBalance(item.account)
    groups.set(key, group)
  }
  const order: AccountGroupKey[] = [...ASSET_CLASS_ORDER, 'debts']
  return order.filter((key) => groups.has(key)).map((key) => {
    const group = groups.get(key)!
    group.items.sort((a, b) => Math.abs(signedBalance(b.account)) - Math.abs(signedBalance(a.account)))
    return group
  })
}

/** The page's KPI row over top-level accounts (pockets are already inside their wallet). */
export function accountKpis(accounts: Account[], now: number) {
  const liabilities = accounts.filter((a) => assetClassOf(a.type) == null)
  const synced = accounts.filter((a) => !a.isManual)
  return {
    assets: accounts.filter((a) => assetClassOf(a.type) != null).reduce((s, a) => s + a.currentBalanceEur, 0),
    debts: -liabilities.reduce((s, a) => s + signedBalance(a), 0),
    count: accounts.length,
    manual: accounts.length - synced.length,
    synced: synced.length,
    upToDate: synced.filter((a) => freshnessLevel(a.lastSyncedAt, SYNC_FRESHNESS_BOUNDS_MS, now) === 'fresh').length,
  }
}
