import type { RecurringCadence, RecurringSeries } from '@/types/api'

/** Charges per year for each cadence: 52 weeks, not 4 weeks × 12 months, which would drop a month. */
const PER_YEAR: Record<RecurringCadence, number> = { WEEKLY: 52, BIWEEKLY: 26, MONTHLY: 12, QUARTERLY: 4, YEARLY: 1 }

/** What one series costs over a year, as a positive amount. */
export function annualCost(series: Pick<RecurringSeries, 'expectedAmount' | 'cadence'>): number {
  return Math.abs(series.expectedAmount) * PER_YEAR[series.cadence]
}

/**
 * Confirmed recurring debits: their yearly and monthly-equivalent cost and the next ones due.
 * A STALE series has missed two periods or more — the backend drops it from the calendar as
 * stopped — so it is left out of the cost too.
 */
export function subscriptionsSummary(series: RecurringSeries[], upcomingCount = 4) {
  const debits = series.filter((s) => s.status === 'CONFIRMED' && s.expectedAmount < 0 && s.runtimeStatus !== 'STALE')
  const annual = debits.reduce((sum, s) => sum + annualCost(s), 0)
  const upcoming = debits
    .filter((s) => s.nextDueDate != null)
    .sort((a, b) => a.nextDueDate!.localeCompare(b.nextDueDate!))
    .slice(0, upcomingCount)
  return { count: debits.length, annual, monthly: annual / 12, upcoming }
}
