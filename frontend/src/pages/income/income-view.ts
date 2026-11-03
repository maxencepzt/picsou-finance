import type { DividendCadence, ReceivedDividend, UpcomingDividend } from '@/types/api'
import type { IncomeMonth, IncomeSource, SavingsInterestLine } from '@/features/income/passive-income'

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

/** Dividends credited over the window. */
// shortcut: non-EUR credits are left out (booked in the account currency, no FX on the client); convert server-side if foreign-currency accounts matter.
export function receivedTotal(rows: ReceivedDividend[]): number {
  return rows.filter((r) => r.currency === 'EUR').reduce((sum, r) => sum + r.amount, 0)
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

/** Short month name of a `YYYY-MM` key, for the chart's axis. */
export function monthLabel(month: string, locale: string): string {
  const [year, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(year, m - 1, 1))
}
