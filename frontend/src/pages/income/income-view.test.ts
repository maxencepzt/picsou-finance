import { describe, expect, it } from 'vitest'
import type { ReceivedDividend, UpcomingDividend } from '@/types/api'
import type { IncomeMonth, SavingsInterestLine } from '@/features/income/passive-income'
import { incomeBySource, nextPayments, receivedTotal } from './income-view'

const dividend = (overrides: Partial<UpcomingDividend>) => ({
  id: 'd', source: 'HOLDING', name: 'LVMH', expectedDate: '2026-12-02', paymentDate: '2026-12-04',
  amountEur: 52, cadence: 'SEMI_ANNUAL', ...overrides,
}) as UpcomingDividend

const passbook = (overrides: Partial<SavingsInterestLine['projection']> = {}): SavingsInterestLine => ({
  accountId: 7,
  name: 'LEP',
  projection: {
    projectedInterestFullYear: 211, estimatedInterestYtd: 180, nextCapitalizationDate: '2026-12-31',
    annualRatePct: 2.7, basis: 'NET' as never, netOfTax: true, ...overrides,
  },
})

const month = (key: string, rent = 0): IncomeMonth => ({ month: key, dividends: 0, scpi: 0, rent, interest: 0 })
const months = ['2026-11', '2026-12', '2027-01'].map((m) => month(m, 100))

describe('income view', () => {
  it('sums EUR credits only', () => {
    const rows = [{ amount: 6, currency: 'EUR' }, { amount: 3.5, currency: 'EUR' }, { amount: 9, currency: 'USD' }] as ReceivedDividend[]
    expect(receivedTotal(rows)).toBe(9.5)
  })

  it('merges dividends and capitalisations, soonest first, capped', () => {
    const payments = nextPayments(
      [
        dividend({ id: 'a', paymentDate: '2027-01-10' }),
        dividend({ id: 'b', paymentDate: null, expectedDate: '2026-11-12' }),
        dividend({ id: 'c', source: 'SCPI', paymentDate: '2026-12-15' }),
      ],
      [passbook()],
      3,
    )
    expect(payments.map((p) => [p.id, p.date, p.source])).toEqual([
      ['b', '2026-11-12', 'dividends'],
      ['c', '2026-12-15', 'scpi'],
      ['interest:7', '2026-12-31', 'interest'],
    ])
    expect(payments[0].exDateOnly).toBe(true)
    expect(payments[2]).toMatchObject({ amount: 211, ratePct: 2.7, cadence: 'ANNUAL' })
  })

  it('groups payers by name inside the schedule, adds passbooks and rent, largest first', () => {
    const rows = incomeBySource(
      months,
      [
        dividend({ id: 'a', paymentDate: '2027-01-20', amountEur: 30, cadence: null }),
        dividend({ id: 'b', paymentDate: '2026-12-04', amountEur: 52 }),
        dividend({ id: 'c', paymentDate: '2027-06-04', amountEur: 999 }), // outside the twelve months
        dividend({ id: 'd', source: 'SCPI', name: 'Pierre', paymentDate: '2026-11-30', amountEur: 132, cadence: 'QUARTERLY' }),
      ],
      [passbook(), passbook({ nextCapitalizationDate: '2027-12-31' })],
    )
    expect(rows.map((r) => [r.key, r.amount, r.cadence, r.nextDate])).toEqual([
      ['rent', 300, 'MONTHLY', null],
      ['interest:7', 211, 'ANNUAL', '2026-12-31'],
      ['scpi:Pierre', 132, 'QUARTERLY', '2026-11-30'],
      ['dividends:LVMH', 82, 'SEMI_ANNUAL', '2026-12-04'],
    ])
  })
})
