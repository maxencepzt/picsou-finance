import type { CashflowBucket } from '@/types/api'

/** (income − expense) ÷ income, in points (23 = 23 %). Null without income: a rate of nothing means nothing. */
export function savingsRate(income: number, expense: number): number | null {
  return income > 0 ? ((income - expense) / income) * 100 : null
}

/**
 * The savings rate of each bucket, and of the whole series. The average is the rate of the summed
 * flows rather than the mean of the points, so one cycle with a tiny income cannot swamp it.
 */
export function savingsRateTrend(series: CashflowBucket[]): {
  points: { label: string; rate: number | null }[]
  average: number | null
} {
  const income = series.reduce((sum, b) => sum + b.income, 0)
  const expense = series.reduce((sum, b) => sum + b.expense, 0)
  return {
    points: series.map((b) => ({ label: b.label, rate: savingsRate(b.income, b.expense) })),
    average: savingsRate(income, expense),
  }
}

/** The bucket just before the one starting on `start`; null when that one is first or missing. */
export function previousBucket(series: CashflowBucket[], start: string | undefined): CashflowBucket | null {
  const i = series.findIndex((b) => b.start === start)
  return i > 0 ? series[i - 1] : null
}
