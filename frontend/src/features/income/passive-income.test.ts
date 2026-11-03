import { describe, expect, it } from 'vitest'
import type { UpcomingDividend } from '@/types/api'
import { incomeSchedule, incomeTotals, nextMonths } from './passive-income'

const dividend = (overrides: Partial<UpcomingDividend>) => ({
  source: 'HOLDING', expectedDate: '2026-12-02', paymentDate: '2026-12-04', amountEur: 52, ...overrides,
}) as UpcomingDividend

describe('passive income schedule', () => {
  const from = new Date(2026, 10, 3) // 3 November 2026

  it('covers the twelve months starting with the current one', () => {
    expect(nextMonths(from)).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04',
      '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10',
    ])
  })

  it('books dividends on their payment date, SCPI apart, rent every month and interest at capitalisation', () => {
    const months = incomeSchedule(
      from,
      [
        dividend({}),
        dividend({ source: 'SCPI', expectedDate: '2027-01-15', paymentDate: '2027-01-15', amountEur: 132 }),
        dividend({ paymentDate: null, expectedDate: '2026-11-12', amountEur: 34 }),
        dividend({ paymentDate: '2028-01-01', amountEur: 999 }),
      ],
      100,
      [{ accountId: 1, name: 'LEP', projection: { projectedInterestFullYear: 211, estimatedInterestYtd: 180, nextCapitalizationDate: '2026-12-31', annualRatePct: 2.7, basis: 'NET' as never, netOfTax: true } }],
    )
    expect(months[0]).toMatchObject({ month: '2026-11', dividends: 34, scpi: 0, rent: 100, interest: 0 })
    expect(months[1]).toMatchObject({ month: '2026-12', dividends: 52, interest: 211 })
    expect(months[2]).toMatchObject({ month: '2027-01', scpi: 132 })

    const totals = incomeTotals(months)
    expect(totals).toMatchObject({ dividends: 86, scpi: 132, rent: 1200, interest: 211 })
    expect(totals.total).toBe(86 + 132 + 1200 + 211)
  })
})
