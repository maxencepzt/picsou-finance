import { ASSET_CLASS_ORDER, assetClassOf, type AssetClassKey } from '@/lib/asset-classes'
import { SYNC_FRESHNESS_BOUNDS_MS, VALUATION_FRESHNESS_BOUNDS_MS } from '@/lib/constants'
import { freshnessLevel, type FreshnessLevel } from '@/lib/utils'
import type { Account, BalanceSnapshot } from '@/types/api'

/** A loan is stored as the positive amount owed, a card debt already negative: both read negative here. */
export function signedBalance(account: Account): number {
  return account.type === 'LOAN' ? -account.currentBalanceEur : account.currentBalanceEur
}

export type AccountGroupKey = AssetClassKey | 'receivables' | 'debts'

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

/** Buckets the items by `keyOf`, totals each one (a wallet's balance already includes its pockets), largest item first. */
function bucket<K extends string>(items: AccountItem[], keyOf: (account: Account) => K): Map<K, { key: K; total: number; items: AccountItem[] }> {
  const groups = new Map<K, { key: K; total: number; items: AccountItem[] }>()
  for (const item of items) {
    const key = keyOf(item.account)
    const group = groups.get(key) ?? { key, total: 0, items: [] }
    group.items.push(item)
    group.total += signedBalance(item.account)
    groups.set(key, group)
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => Math.abs(signedBalance(b.account)) - Math.abs(signedBalance(a.account)))
  }
  return groups
}

/**
 * Accounts by asset class in the palette's order, then the money lent to people (an asset, but
 * no investment class), then the liabilities.
 */
export function groupByAssetClass(items: AccountItem[]): AccountGroup[] {
  const groups = bucket<AccountGroupKey>(items, (account) =>
    account.type === 'PEER_LOAN' ? 'receivables' : assetClassOf(account.type) ?? 'debts')
  const order: AccountGroupKey[] = [...ASSET_CLASS_ORDER, 'receivables', 'debts']
  return order.filter((key) => groups.has(key)).map((key) => groups.get(key)!)
}

export interface InstitutionGroup {
  /** `manual`, `property`, or `bank:<provider, lower-cased>`. */
  key: string
  /** The provider as the first account of the group spells it; null for the two buckets. */
  label: string | null
  total: number
  items: AccountItem[]
}

/**
 * Accounts by institution (`provider`), largest net total first, then the accounts that name no
 * institution ("manual") and the properties. A manual account that names its bank (a loan typed
 * in by hand) stays with that bank: the view answers "what do I have where".
 */
export function groupByInstitution(items: AccountItem[]): InstitutionGroup[] {
  const groups = bucket(items, (account) => {
    if (account.type === 'REAL_ESTATE') return 'property'
    const provider = account.provider?.trim()
    return provider ? `bank:${provider.toLocaleLowerCase()}` : 'manual'
  })
  const banks = [...groups.values()].filter((g) => g.key.startsWith('bank:')).sort((a, b) => b.total - a.total)
  return [...banks, groups.get('manual'), groups.get('property')]
    .filter((g) => g != null)
    .map((g) => ({ ...g, label: g.key.startsWith('bank:') ? g.items[0].account.provider!.trim() : null }))
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

/** Freshness dot colour per level, matching FRESHNESS_TEXT_CLASS. */
export const FRESHNESS_DOT_CLASS: Record<FreshnessLevel, string> = {
  fresh: 'bg-gain', recent: 'bg-warning', stale: 'bg-warning', old: 'bg-loss', unknown: 'bg-muted-foreground',
}

/**
 * How old the account's figure is: a property's last valuation on the monthly scale, else the last
 * sync on the daily one; null when neither date exists. `warn` asks the user to reconnect, which
 * only makes sense for a synced account.
 */
export function accountFreshness(account: Account, now: number) {
  const valuedAt = account.type === 'REAL_ESTATE' ? account.realEstate?.lastValuedAt : null
  const date = valuedAt ?? account.lastSyncedAt
  if (!date) return null
  const level = freshnessLevel(date, valuedAt ? VALUATION_FRESHNESS_BOUNDS_MS : SYNC_FRESHNESS_BOUNDS_MS, now)
  return { date, level, valuation: valuedAt != null, warn: !account.isManual && (level === 'stale' || level === 'old') }
}

/** `YYYY-MM-DD` one calendar month before (day clamped by the string compare, not a date library). */
function monthBefore(date: string): string {
  const [y, m] = date.split('-').map(Number)
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
  return `${prev}${date.slice(7, 10)}`
}

/**
 * Change of the balance over the last month of snapshots: the latest one against the last one
 * dated a month or more before it. Null when the history does not reach that far back.
 */
export function monthChange(history: Pick<BalanceSnapshot, 'date' | 'balance'>[]): { amount: number; percent: number | null } | null {
  if (history.length < 2) return null
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted[sorted.length - 1]
  const cutoff = monthBefore(latest.date)
  const base = sorted.filter((s) => s.date <= cutoff).at(-1)
  if (!base) return null
  const amount = latest.balance - base.balance
  return { amount, percent: base.balance !== 0 ? (amount / Math.abs(base.balance)) * 100 : null }
}
