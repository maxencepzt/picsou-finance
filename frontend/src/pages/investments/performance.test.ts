import { describe, expect, it } from 'vitest'
import type { FeeLine, PerformancePoint } from '@/types/api'
import { compareToBenchmark, costliestLines, dateTickFormat, dateTicks, feeCoverage } from './performance'

const point = (date: string, index: number): PerformancePoint => ({ date, valueEur: 0, investedEur: 0, index })

describe('compareToBenchmark', () => {
  it('rebases both series to 100 on the first date they share and keeps only shared dates', () => {
    const points = [point('2026-01-02', 100), point('2026-01-03', 104), point('2026-01-05', 110), point('2026-01-06', 99)]
    // No close on the 2nd (portfolio only) nor on the 4th (benchmark only, no snapshot).
    const closes = [
      { date: '2026-01-03', priceEur: 50 },
      { date: '2026-01-04', priceEur: 51 },
      { date: '2026-01-05', priceEur: 55 },
      { date: '2026-01-06', priceEur: 48 },
    ]
    const rows = compareToBenchmark(points, closes)
    expect(rows.map((r) => r.date)).toEqual(['2026-01-03', '2026-01-05', '2026-01-06'])
    // Portfolio: 104 → 100, 110 / 104 = 105.769…, 99 / 104 = 95.192…
    expect(rows.map((r) => r.portfolio)).toEqual([100, expect.closeTo(105.769, 3), expect.closeTo(95.192, 3)])
    // Benchmark: 50 → 100, 55 → 110, 48 → 96.
    expect(rows.map((r) => r.benchmark)).toEqual([100, expect.closeTo(110, 9), expect.closeTo(96, 9)])
  })

  it('rebases the portfolio alone without a benchmark, and returns nothing when no date is shared', () => {
    const points = [point('2026-01-02', 100), point('2026-01-03', 101.5)]
    expect(compareToBenchmark(points, null)).toEqual([
      { date: '2026-01-02', portfolio: 100, benchmark: null },
      { date: '2026-01-03', portfolio: expect.closeTo(101.5, 9), benchmark: null },
    ])
    // An index that does not start at 100 is brought back to it: 104 → 100, 110.24 → 106.
    expect(compareToBenchmark([point('2026-01-02', 104), point('2026-01-03', 110.24)], null).map((r) => r.portfolio))
      .toEqual([100, expect.closeTo(106, 9)])
    expect(compareToBenchmark(points, [])).toEqual([])
    expect(compareToBenchmark(points, [{ date: '2025-12-31', priceEur: 10 }])).toEqual([])
  })
})

describe('fees', () => {
  const line = (ticker: string, valueEur: number, terPercent: number | null): FeeLine => ({ ticker, name: null, valueEur, terPercent })

  it('ranks the lines with a TER by yearly cost and sums up the rest past the top', () => {
    const { top, rest } = costliestLines([
      line('A', 10000, 0.2), // 20 €/yr
      line('B', 5000, 0.5), // 25 €/yr
      line('AAPL', 8000, null), // a share: no TER, not ranked
      line('C', 1000, 0.3), // 3 €/yr
      line('D', 2000, 0.07), // 1.40 €/yr
    ], 2)
    expect(top.map((l) => [l.ticker, l.costEur])).toEqual([['B', 25], ['A', 20]])
    expect(rest?.count).toBe(2)
    expect(rest?.costEur).toBeCloseTo(4.4, 9)
  })

  it('has no rest when every line fits in the top', () => {
    expect(costliestLines([line('A', 100, 1)]).rest).toBeNull()
  })

  it('states the share of the value whose TER is known, and nothing when nothing is held', () => {
    expect(feeCoverage({ coveredValueEur: 27860, totalValueEur: 46810 })).toBeCloseTo(59.517, 3)
    expect(feeCoverage({ coveredValueEur: 0, totalValueEur: 0 })).toBeNull()
  })
})

describe('date ticks', () => {
  const at = (iso: string) => new Date(iso).getTime()

  it('ticks on the first of every n-th month, at most six, so no month is printed twice', () => {
    const ticks = dateTicks(at('2025-11-03T00:00'), at('2026-11-03T00:00'))
    // Twelve month starts (Dec → Nov), every second one kept.
    expect(ticks.map((t) => new Date(t).getDate())).toEqual([1, 1, 1, 1, 1, 1])
    expect(ticks.map((t) => new Date(t).getMonth())).toEqual([11, 1, 3, 5, 7, 9])
    expect(dateTickFormat(at('2025-11-03T00:00'), at('2026-11-03T00:00'))).toEqual({ month: 'short' })
  })

  it('spreads days evenly on a short span and keeps a year on a long one', () => {
    // January: no daylight-saving change inside the span.
    const from = at('2026-01-01T00:00')
    const to = at('2026-01-31T00:00')
    const ticks = dateTicks(from, to, 4)
    expect(ticks).toEqual([from, from + 10 * 86_400_000, from + 20 * 86_400_000, to])
    expect(dateTickFormat(from, to)).toEqual({ day: 'numeric', month: 'short' })
    expect(dateTickFormat(at('2021-11-03T00:00'), at('2026-11-03T00:00'))).toEqual({ month: 'short', year: '2-digit' })
    expect(dateTicks(from, from)).toEqual([from])
  })
})
