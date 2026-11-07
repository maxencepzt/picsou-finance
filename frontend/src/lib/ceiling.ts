import type { Account } from '@/types/api'

/**
 * The legal contribution ceiling of a classic PEA. A PEA jeune caps at 20 000 € instead; the
 * member states that on the account (`depositCeiling`), which then wins over this default.
 */
export const PEA_DEFAULT_DEPOSIT_CEILING = 150_000

/** From this share of the ceiling the gauge turns to `--warning` (DESIGN.md: "an envelope at 80 %"). */
export const CEILING_WARNING_PCT = 80

export type CeilingState = 'ok' | 'warning' | 'full'

export interface CeilingUsage {
  /** What counts against the ceiling: a livret's balance, a PEA's contributions. */
  used: number
  ceiling: number
  /** Never negative: a livret over its ceiling (capitalised interest) has nothing left. */
  remaining: number
  /** Unclamped, so a livret past its ceiling reads 104 %; the ring clamps itself. */
  pct: number
  state: CeilingState
  /** A PEA measures contributions, a livret its balance: the label differs. */
  kind: 'deposits' | 'balance'
}

export function ceilingUsage(used: number, ceiling: number, kind: CeilingUsage['kind']): CeilingUsage {
  const pct = (Math.max(0, used) / ceiling) * 100
  const state: CeilingState = pct >= 100 ? 'full' : pct >= CEILING_WARNING_PCT ? 'warning' : 'ok'
  return { used, ceiling, remaining: Math.max(0, ceiling - used), pct, state, kind }
}

/**
 * How far an account is into its ceiling, or null when it has none: a livret with a configured
 * ceiling, or a PEA (stated ceiling, else the legal one).
 *
 * @param invested the cost basis the caller already shows ("Capital investi"); falls back to the
 *                 one the API reports on the account, so the list and the detail page agree.
 */
export function accountCeiling(
  account: Pick<Account, 'type' | 'currentBalanceEur' | 'savingsConfig' | 'depositCeiling' | 'investedEur'>,
  invested?: number | null,
): CeilingUsage | null {
  if (account.type === 'PEA') {
    // shortcut: the cost basis approximates net contributions (reinvested dividends and
    // realised gains make them differ); measure real deposits once Picsou tracks them.
    const used = invested ?? account.investedEur
    if (used == null) return null
    return ceilingUsage(used, account.depositCeiling ?? PEA_DEFAULT_DEPOSIT_CEILING, 'deposits')
  }
  const ceiling = account.savingsConfig?.ceiling
  if (ceiling == null || ceiling <= 0) return null
  return ceilingUsage(account.currentBalanceEur, ceiling, 'balance')
}
