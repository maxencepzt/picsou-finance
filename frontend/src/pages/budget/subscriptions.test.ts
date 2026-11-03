import { describe, expect, it } from 'vitest'
import type { RecurringCadence, RecurringSeries } from '@/types/api'
import { annualCost, subscriptionsSummary } from './subscriptions'

function series(id: number, expectedAmount: number, cadence: RecurringCadence, extra: Partial<RecurringSeries> = {}): RecurringSeries {
  return {
    id, label: `S${id}`, counterparty: null, expectedAmount, cadence, status: 'CONFIRMED',
    nextDueDate: null, lastSeenDate: null, categoryId: null, categoryName: null, categoryColor: null,
    categoryIcon: null, confidence: null, amountMin: null, amountMax: null, variable: false,
    previousAmount: null, priceChangedAt: null, autoConfirmed: false, runtimeStatus: 'SCHEDULED', ...extra,
  }
}

describe('annualCost', () => {
  it('counts 52 weeks, 26 fortnights, 12 months, 4 quarters and 1 year', () => {
    expect(annualCost(series(1, -10, 'WEEKLY'))).toBe(520)
    expect(annualCost(series(1, -10, 'BIWEEKLY'))).toBe(260)
    expect(annualCost(series(1, -10, 'MONTHLY'))).toBe(120)
    expect(annualCost(series(1, -30, 'QUARTERLY'))).toBe(120)
    expect(annualCost(series(1, -120, 'YEARLY'))).toBe(120)
  })
})

describe('subscriptionsSummary', () => {
  it('sums confirmed debits only and lists the next ones due, soonest first', () => {
    const summary = subscriptionsSummary([
      series(1, -13.49, 'MONTHLY', { nextDueDate: '2026-11-09' }),
      series(2, -120, 'YEARLY', { nextDueDate: '2026-11-05' }),
      series(3, -5, 'WEEKLY', { nextDueDate: '2026-11-04' }),
      series(4, -10.99, 'MONTHLY', { status: 'SUGGESTED', nextDueDate: '2026-11-03' }),
      series(5, -42.6, 'MONTHLY', { status: 'IGNORED' }),
      series(6, 3200, 'MONTHLY', { nextDueDate: '2026-11-01' }),
      series(7, -9.99, 'MONTHLY', { runtimeStatus: 'STALE', nextDueDate: '2026-08-01' }),
      series(8, -60, 'QUARTERLY', { nextDueDate: '2026-12-15' }),
      series(9, -1, 'MONTHLY'),
    ])
    // 13.49 × 12 + 120 + 5 × 52 + 60 × 4 + 1 × 12 = 161.88 + 120 + 260 + 240 + 12
    expect(summary.annual).toBeCloseTo(793.88, 2)
    expect(summary.monthly).toBeCloseTo(66.157, 3)
    expect(summary.count).toBe(5)
    expect(summary.upcoming.map((s) => s.id)).toEqual([3, 2, 1, 8])
  })

  it('is zero without a confirmed debit', () => {
    expect(subscriptionsSummary([series(1, 3200, 'MONTHLY')])).toEqual({ count: 0, annual: 0, monthly: 0, upcoming: [] })
  })
})
