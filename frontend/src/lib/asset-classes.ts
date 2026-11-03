import type { AccountType } from '@/types/api'

/** The asset classes the interface colours consistently (one fixed colour per class). */
export type AssetClassKey = 'cash' | 'savings' | 'equity' | 'crypto' | 'funds' | 'scpi' | 'realestate' | 'other'

/** Display order, also the order the palette was validated in. */
export const ASSET_CLASS_ORDER: AssetClassKey[] = ['cash', 'savings', 'equity', 'crypto', 'funds', 'scpi', 'realestate', 'other']

const CLASS_OF: Record<AccountType, AssetClassKey | null> = {
  CHECKING: 'cash',
  SAVINGS: 'savings', LEP: 'savings', LIVRET_A: 'savings', LDDS: 'savings', LIVRET_JEUNE: 'savings', PEL: 'savings', CEL: 'savings',
  PEA: 'equity', COMPTE_TITRES: 'equity',
  CRYPTO: 'crypto',
  ASSURANCE_VIE: 'funds', PER: 'funds', EMPLOYEE_SAVINGS: 'funds',
  SCPI: 'scpi',
  REAL_ESTATE: 'realestate',
  OTHER: 'other',
  LOAN: null, CREDIT_CARD: null,
}

/** The class an account's balance belongs to; null for a liability. */
export function assetClassOf(type: AccountType): AssetClassKey | null {
  // An unknown type (a backend newer than this client) is shown as "other", never dropped.
  return type in CLASS_OF ? CLASS_OF[type] : 'other'
}

/** CSS colour of a class, from the theme (`--class-*`). */
export function assetClassColor(key: AssetClassKey): string {
  return `var(--class-${key})`
}

/** How fast a balance can turn into cash. */
export type LiquidityKey = 'available' | 'market' | 'locked' | 'illiquid'
export const LIQUIDITY_ORDER: LiquidityKey[] = ['available', 'market', 'locked', 'illiquid']

const LIQUIDITY_OF: Record<AssetClassKey, LiquidityKey> = {
  cash: 'available', savings: 'available',
  equity: 'market', crypto: 'market',
  funds: 'locked',
  scpi: 'illiquid', realestate: 'illiquid', other: 'illiquid',
}

/** A PEA is equity, but its money is locked until it is five years old: it counts as locked. */
export function liquidityOf(type: AccountType): LiquidityKey | null {
  if (type === 'PEA') return 'locked'
  const cls = assetClassOf(type)
  return cls ? LIQUIDITY_OF[cls] : null
}

/** One step of a single-hue ramp per bucket, lightest = most liquid (ordered, not categorical). */
export const LIQUIDITY_COLOR: Record<LiquidityKey, string> = {
  available: 'var(--chart-4)',
  market: 'var(--chart-2)',
  locked: 'var(--chart-1)',
  illiquid: 'var(--chart-3)',
}

/** Sums balances per key, dropping empty keys, in the given order. */
export function sumBy<K extends string>(
  rows: { type: AccountType; amount: number }[],
  keyOf: (type: AccountType) => K | null,
  order: K[],
): { key: K; amount: number }[] {
  const totals = new Map<K, number>()
  for (const row of rows) {
    const key = keyOf(row.type)
    if (key == null || row.amount <= 0) continue
    totals.set(key, (totals.get(key) ?? 0) + row.amount)
  }
  return order.filter((key) => totals.has(key)).map((key) => ({ key, amount: totals.get(key)! }))
}
