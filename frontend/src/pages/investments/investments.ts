import type { PortfolioLine } from '@/features/accounts/hooks'
import { HOLDING_ACCOUNT_TYPES } from '@/lib/constants'
import type { Account, AccountType, RealizedLot } from '@/types/api'

/** The wrapper filter of the positions table. */
export type Wrapper = 'PEA' | 'COMPTE_TITRES' | 'CRYPTO' | 'other'
export const WRAPPERS: Wrapper[] = ['PEA', 'COMPTE_TITRES', 'CRYPTO', 'other']

export function wrapperOf(type: AccountType): Wrapper {
  return type === 'PEA' || type === 'COMPTE_TITRES' || type === 'CRYPTO' ? type : 'other'
}

/** The lines held in an investment wrapper: drops the aggregated bank-cash row of `usePortfolio`. */
export function investmentLines(lines: PortfolioLine[]): PortfolioLine[] {
  return lines.filter((line) => HOLDING_ACCOUNT_TYPES.includes(line.accountType))
}

/** Value, capital invested and unrealised gain; the percent is over the lines whose cost is known. */
export function portfolioTotals(lines: PortfolioLine[]) {
  let value = 0
  let invested = 0
  let pnl = 0
  let pnlBase = 0
  for (const line of lines) {
    value += line.valueEur
    if (line.costBasisEur != null) invested += line.costBasisEur
    if (line.pnlEur != null && line.costBasisEur != null) {
      pnl += line.pnlEur
      pnlBase += line.costBasisEur
    }
  }
  return { value, invested, pnl, pnlPercent: pnlBase > 0 ? (pnl / pnlBase) * 100 : null }
}

export interface Concentration {
  /** How many lines the top share covers: three, or fewer when there are fewer. */
  topCount: number
  topShare: number
  largest: PortfolioLine
  largestShare: number
}

/**
 * Share of the largest lines. One security held in two wrappers is one exposure, so lines are
 * merged by ticker first; cash rows (a PER's euro fund) stay apart.
 */
export function concentration(lines: PortfolioLine[]): Concentration | null {
  const groups = new Map<string, { line: PortfolioLine; value: number }>()
  for (const line of lines) {
    const key = line.isCash || !line.ticker ? line.id : line.ticker
    const group = groups.get(key)
    if (group) group.value += line.valueEur
    else groups.set(key, { line, value: line.valueEur })
  }
  const sorted = [...groups.values()].filter((g) => g.value > 0).sort((a, b) => b.value - a.value)
  const total = sorted.reduce((sum, g) => sum + g.value, 0)
  if (total <= 0) return null
  const top = sorted.slice(0, 3)
  return {
    topCount: top.length,
    topShare: (top.reduce((sum, g) => sum + g.value, 0) / total) * 100,
    largest: sorted[0].line,
    largestShare: (sorted[0].value / total) * 100,
  }
}

/** Value per listing currency, largest first; a line without one is quoted in euros. */
export function currencySplit(lines: PortfolioLine[]): { currency: string; amount: number; share: number }[] {
  const totals = new Map<string, number>()
  for (const line of lines) {
    if (line.valueEur <= 0) continue
    const currency = line.listingCurrency ?? line.quoteCurrency ?? 'EUR'
    totals.set(currency, (totals.get(currency) ?? 0) + line.valueEur)
  }
  const total = [...totals.values()].reduce((sum, amount) => sum + amount, 0)
  return [...totals]
    .map(([currency, amount]) => ({ currency, amount, share: (amount / total) * 100 }))
    .sort((a, b) => b.amount - a.amount)
}

/**
 * Today's rate from the account's currency to euros, read off its balance.
 * shortcut: an emptied non-EUR account has no balance to read a rate from and counts at par; upgrade when the API sends realised amounts in EUR.
 */
export function eurRate(account: Pick<Account, 'currency' | 'currentBalance' | 'currentBalanceEur'>): number {
  return account.currency === 'EUR' || !account.currentBalance ? 1 : account.currentBalanceEur / account.currentBalance
}

/** One account's closed lots, with what turns its currency into euros. */
export interface RealizedSource {
  accountId: number
  accountName: string
  accountType: AccountType
  rate: number
  lots: RealizedLot[]
}

/** The calendar years that saw at least one sale, oldest first. */
export function realizedYears(sources: RealizedSource[]): number[] {
  const years = new Set(sources.flatMap((s) => s.lots.map((lot) => Number(lot.date.slice(0, 4)))))
  return [...years].sort((a, b) => a - b)
}

export interface RealizedPosition {
  key: string
  name: string
  accountName: string
  accountType: AccountType
  /** Net realised over the year, in euros. */
  amount: number
}

/**
 * The year's realised result per position (one ticker in one account), split into gains and
 * losses: a part-to-whole can only draw the gains, so the losses are listed beside it.
 */
export function realizedInYear(sources: RealizedSource[], year: number) {
  const positions = new Map<string, RealizedPosition>()
  let sales = 0
  for (const source of sources) {
    for (const lot of source.lots) {
      if (lot.date.slice(0, 4) !== String(year)) continue
      sales += 1
      const key = `${source.accountId}-${lot.ticker}`
      const position = positions.get(key) ?? {
        key,
        name: lot.name ?? lot.ticker,
        accountName: source.accountName,
        accountType: source.accountType,
        amount: 0,
      }
      position.amount += lot.realized * source.rate
      positions.set(key, position)
    }
  }
  const all = [...positions.values()]
  const gains = all.filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount)
  const losses = all.filter((p) => p.amount < 0).sort((a, b) => a.amount - b.amount)
  const gainTotal = gains.reduce((sum, p) => sum + p.amount, 0)
  const lossTotal = losses.reduce((sum, p) => sum + p.amount, 0)
  return { gains, losses, gainTotal, lossTotal, net: gainTotal + lossTotal, sales }
}

/** Years after which the wrapper's tax advantage applies: PEA gains leave income tax, assurance vie gets its allowance. */
export const TAX_WRAPPER_YEARS: Partial<Record<AccountType, number>> = { PEA: 5, ASSURANCE_VIE: 8 }

export interface Maturity {
  thresholdYears: number
  years: number
  months: number
  /** 0–100, toward the threshold. */
  progress: number
  /** ISO date of the anniversary that crosses the threshold. */
  maturityDate: string
  reached: boolean
}

/** Age of a PEA or assurance vie from its opening date; null when the date was never given. */
export function maturity(account: Pick<Account, 'type' | 'openedAt'>, now: Date): Maturity | null {
  const thresholdYears = TAX_WRAPPER_YEARS[account.type]
  if (!thresholdYears || !account.openedAt) return null
  const [year, month, day] = account.openedAt.slice(0, 10).split('-').map(Number)
  const elapsed = Math.max(0, (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) - (now.getDate() < day ? 1 : 0))
  const thresholdMonths = thresholdYears * 12
  return {
    thresholdYears,
    years: Math.floor(elapsed / 12),
    months: elapsed % 12,
    progress: Math.min(100, (elapsed / thresholdMonths) * 100),
    maturityDate: `${year + thresholdYears}${account.openedAt.slice(4, 10)}`,
    reached: elapsed >= thresholdMonths,
  }
}
