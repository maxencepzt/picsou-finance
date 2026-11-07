import type { SavingsInterestProjection, UpcomingDividend } from '@/types/api'

export type IncomeSource = 'dividends' | 'scpi' | 'rent' | 'interest'

export interface IncomeMonth {
  /** `YYYY-MM` */
  month: string
  dividends: number
  scpi: number
  rent: number
  interest: number
}

export interface SavingsInterestLine {
  accountId: number
  name: string
  projection: SavingsInterestProjection
}

/** Twelve `YYYY-MM` keys starting at `from`'s month. */
export function nextMonths(from: Date, count = 12): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

/**
 * The next twelve months of passive income, month by month: projected dividends and SCPI
 * distributions on their payment date, rent spread evenly, savings interest on the day it is
 * capitalised. A forecast, built only from what the backend already projects.
 */
export function incomeSchedule(
  from: Date,
  dividends: UpcomingDividend[],
  monthlyRent: number,
  savings: SavingsInterestLine[],
): IncomeMonth[] {
  const months = nextMonths(from).map((month) => ({ month, dividends: 0, scpi: 0, rent: monthlyRent, interest: 0 }))
  const byMonth = new Map(months.map((m) => [m.month, m]))
  for (const d of dividends) {
    const bucket = byMonth.get((d.paymentDate ?? d.expectedDate).slice(0, 7))
    if (!bucket) continue
    if (d.source === 'SCPI') bucket.scpi += d.amountEur
    else bucket.dividends += d.amountEur
  }
  // A passbook credits the whole year's interest at once, on its capitalisation date.
  for (const line of savings) {
    const bucket = byMonth.get(line.projection.nextCapitalizationDate.slice(0, 7))
    if (bucket) bucket.interest += line.projection.projectedInterestFullYear
  }
  return months
}

/** The yearly totals per source over a schedule. */
export function incomeTotals(months: IncomeMonth[]): Record<IncomeSource, number> & { total: number } {
  const totals = { dividends: 0, scpi: 0, rent: 0, interest: 0 }
  for (const m of months) {
    totals.dividends += m.dividends
    totals.scpi += m.scpi
    totals.rent += m.rent
    totals.interest += m.interest
  }
  return { ...totals, total: totals.dividends + totals.scpi + totals.rent + totals.interest }
}
