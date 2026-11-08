import type { DividendCadence, ReceivedDividend, UpcomingDividend } from '@/types/api'
import { nextMonths, type IncomeMonth, type IncomeSource, type SavingsInterestLine } from '@/features/income/passive-income'

export const INCOME_SOURCES: IncomeSource[] = ['dividends', 'scpi', 'rent', 'interest']

export const SOURCE_COLORS: Record<IncomeSource, string> = {
  dividends: 'var(--class-equity)',
  scpi: 'var(--class-scpi)',
  rent: 'var(--class-realestate)',
  interest: 'var(--class-savings)',
}

/** One dated payment, a projected dividend or distribution or a passbook capitalisation. */
export interface IncomePayment {
  id: string
  /** `YYYY-MM-DD`: the payment date, or the ex-date when no payment date was learned. */
  date: string
  name: string
  source: IncomeSource
  amount: number
  /** True when `date` is the ex-date because no payment date is known. */
  exDateOnly: boolean
  cadence: DividendCadence | null
  ratePct: number | null
}

/** One payer over the next twelve months. `name` is null for the rent row, which has no payer name. */
export interface IncomeSourceRow {
  key: string
  name: string | null
  source: IncomeSource
  amount: number
  cadence: DividendCadence | null
  ratePct: number | null
  nextDate: string | null
}

const dividendSource = (d: UpcomingDividend): IncomeSource => (d.source === 'SCPI' ? 'scpi' : 'dividends')
const paymentDate = (d: UpcomingDividend) => d.paymentDate ?? d.expectedDate

/**
 * A reward credited on a crypto account (staking, Earn interest), which the backend records as a
 * dividend. The page keeps it apart from share dividends so neither hides the other.
 */
export const isCryptoReward = (r: ReceivedDividend) => r.accountType === 'CRYPTO'

/** Dividends credited over the window, in euros whatever the account currency; a credit with no rate (`amountEur` null) is left out. */
export function receivedTotal(rows: ReceivedDividend[]): number {
  return rows.reduce((sum, r) => sum + (r.amountEur ?? 0), 0)
}

/** Which months the chart shows: the twelve received up to now, the twelve forecast from now, or both. */
export type IncomePeriod = 'past' | 'next' | 'both'

/** One bar of the months chart. A null value is a side the month does not belong to (no bar, no tooltip row). */
export type IncomeChartRow = { month: string; received: number | null; receivedCrypto: number | null } & Record<IncomeSource, number | null>

/**
 * The bars of the months chart. The twelve months up to the current one carry the dividends and the
 * crypto rewards received, apart (by credit date, in euros, credits with no rate left out); the twelve
 * from the current one carry the
 * forecast by source. The current month belongs to both, so "both" shows 23 bars.
 */
export function incomeChartRows(forecast: IncomeMonth[], received: ReceivedDividend[], period: IncomePeriod): IncomeChartRow[] {
  const [year, month] = forecast[0].month.split('-').map(Number)
  const past = period === 'next' ? [] : nextMonths(new Date(year, month - 12, 1))
  const next = new Map(period === 'past' ? [] : forecast.map((m) => [m.month, m]))
  const receivedByMonth = new Map<string, number>()
  const cryptoByMonth = new Map<string, number>()
  for (const r of received) {
    if (r.amountEur == null) continue
    const key = r.receivedDate.slice(0, 7)
    const byMonth = isCryptoReward(r) ? cryptoByMonth : receivedByMonth
    byMonth.set(key, (byMonth.get(key) ?? 0) + r.amountEur)
  }
  return [...new Set([...past, ...next.keys()])].map((key) => {
    const f = next.get(key)
    return {
      month: key,
      received: past.includes(key) ? (receivedByMonth.get(key) ?? 0) : null,
      receivedCrypto: past.includes(key) ? (cryptoByMonth.get(key) ?? 0) : null,
      dividends: f ? f.dividends : null,
      scpi: f ? f.scpi : null,
      rent: f ? f.rent : null,
      interest: f ? f.interest : null,
    }
  })
}

/** The next `limit` payments: projected dividends and distributions plus passbook capitalisations, soonest first. */
export function nextPayments(upcoming: UpcomingDividend[], savings: SavingsInterestLine[], limit = 8): IncomePayment[] {
  return [
    ...upcoming.map((d) => ({
      id: d.id,
      date: paymentDate(d),
      name: d.name,
      source: dividendSource(d),
      amount: d.amountEur,
      exDateOnly: d.paymentDate == null,
      cadence: d.cadence,
      ratePct: null,
    })),
    ...savings.map((s) => ({
      id: `interest:${s.accountId}`,
      date: s.projection.nextCapitalizationDate,
      name: s.name,
      source: 'interest' as const,
      amount: s.projection.projectedInterestFullYear,
      exDateOnly: false,
      cadence: 'ANNUAL' as const,
      ratePct: s.projection.annualRatePct,
    })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

/**
 * One row per payer over the schedule's twelve months, largest first: dividend payers and SCPI
 * grouped by name, one row per passbook, one for rent. Only payments inside the schedule count,
 * so the rows add up to the schedule's total.
 */
export function incomeBySource(
  months: IncomeMonth[],
  upcoming: UpcomingDividend[],
  savings: SavingsInterestLine[],
): IncomeSourceRow[] {
  const inWindow = new Set(months.map((m) => m.month))
  const groups = new Map<string, IncomeSourceRow>()
  for (const d of upcoming) {
    const date = paymentDate(d)
    if (!inWindow.has(date.slice(0, 7))) continue
    const source = dividendSource(d)
    const key = `${source}:${d.name}`
    const row = groups.get(key)
    if (!row) {
      groups.set(key, { key, name: d.name, source, amount: d.amountEur, cadence: d.cadence, ratePct: null, nextDate: date })
      continue
    }
    row.amount += d.amountEur
    row.cadence ??= d.cadence
    if (date < row.nextDate!) row.nextDate = date
  }

  const passbooks = savings
    .filter((s) => inWindow.has(s.projection.nextCapitalizationDate.slice(0, 7)))
    .map((s): IncomeSourceRow => ({
      key: `interest:${s.accountId}`,
      name: s.name,
      source: 'interest',
      amount: s.projection.projectedInterestFullYear,
      cadence: 'ANNUAL',
      ratePct: s.projection.annualRatePct,
      nextDate: s.projection.nextCapitalizationDate,
    }))

  const rent = months.reduce((sum, m) => sum + m.rent, 0)
  const rentRow: IncomeSourceRow[] = rent > 0
    ? [{ key: 'rent', name: null, source: 'rent', amount: rent, cadence: 'MONTHLY', ratePct: null, nextDate: null }]
    : []

  return [...groups.values(), ...passbooks, ...rentRow].sort((a, b) => b.amount - a.amount)
}

/**
 * A `YYYY-MM` key for the chart: a short month on the axis, January with its year so a 23-month axis
 * reads unambiguously; month and year in full for the tooltip.
 */
export function monthLabel(month: string, locale: string, full = false, withYear = false): string {
  const [year, m] = month.split('-').map(Number)
  const format: Intl.DateTimeFormatOptions = full
    ? { month: 'long', year: 'numeric' }
    : m === 1 || withYear ? { month: 'short', year: '2-digit' } : { month: 'short' }
  return new Intl.DateTimeFormat(locale, format).format(new Date(year, m - 1, 1))
}
