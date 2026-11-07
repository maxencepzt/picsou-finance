import { describe, expect, it } from 'vitest'
import type { CashflowBucket } from '@/types/api'
import { previousBucket, savingsRate, savingsRateTrend } from './savings-rate'

const bucket = (start: string, income: number, expense: number): CashflowBucket => ({
  start, end: start, label: start.slice(0, 7), income, expense, net: income - expense,
})

describe('savingsRate', () => {
  it('is (income − expense) ÷ income, negative when overspending, null without income', () => {
    expect(savingsRate(1000, 750)).toBe(25)
    expect(savingsRate(1000, 1200)).toBe(-20)
    expect(savingsRate(0, 300)).toBeNull()
  })
})

describe('savingsRateTrend', () => {
  it('gives one point per bucket and the rate of the summed flows as average', () => {
    const { points, average } = savingsRateTrend([
      bucket('2026-01-01', 3000, 2400),
      bucket('2026-02-01', 0, 500),
      bucket('2026-03-01', 100, 0),
    ])
    expect(points).toEqual([
      { label: '2026-01', rate: 20 },
      { label: '2026-02', rate: null },
      { label: '2026-03', rate: 100 },
    ])
    // (3100 − 2900) ÷ 3100, not the mean of 20 and 100.
    expect(average).toBeCloseTo(6.45, 2)
  })

  it('has no average for an empty series', () => {
    expect(savingsRateTrend([])).toEqual({ points: [], average: null })
  })
})

describe('previousBucket', () => {
  const series = [bucket('2026-01-01', 1, 1), bucket('2026-02-01', 2, 2)]

  it('returns the bucket before the given cycle start', () => {
    expect(previousBucket(series, '2026-02-01')).toBe(series[0])
  })

  it('returns null for the first bucket or an unknown start', () => {
    expect(previousBucket(series, '2026-01-01')).toBeNull()
    expect(previousBucket(series, '2026-05-01')).toBeNull()
    expect(previousBucket(series, undefined)).toBeNull()
  })
})
