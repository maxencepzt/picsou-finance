import { describe, expect, it } from 'vitest'
import type { ReceivedDividend, UpcomingDividend } from '@/types/api'
import type { IncomeMonth, SavingsInterestLine } from '@/features/income/passive-income'
import { incomeBySource, incomeChartRows, nextPayments, receivedTotal } from './income-view'

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
  it('sums every currency through amountEur and leaves out credits with no rate', () => {
    const rows = [
      { amount: 6, currency: 'EUR', amountEur: 6 },
      { amount: 9, currency: 'USD', amountEur: 8.25 },
      { amount: 4, currency: 'GBP', amountEur: null },
    ] as ReceivedDividend[]
    expect(receivedTotal(rows)).toBe(14.25)
  })

  it('puts received credits on the twelve months up to now and the forecast on the twelve from now', () => {
    const forecast = Array.from({ length: 12 }, (_, i) => ({
      ...month(i < 2 ? `2026-${11 + i}` : `2027-${String(i - 1).padStart(2, '0')}`), dividends: 10 + i,
    }))
    const received = [
      { receivedDate: '2025-11-20', amountEur: 99 }, // 12 months back: outside the window
      { receivedDate: '2025-12-02', amountEur: 6 },
      { receivedDate: '2026-03-14', amountEur: 4 },
      { receivedDate: '2026-03-28', amountEur: 2.5 },
      { receivedDate: '2026-11-02', amountEur: 3 },
      { receivedDate: '2026-11-03', amountEur: null }, // no rate: left out
    ] as ReceivedDividend[]

    const both = incomeChartRows(forecast, received, 'both')
    expect(both).toHaveLength(23)
    expect(both[0]).toEqual({ month: '2025-12', received: 6, receivedCrypto: 0, dividends: null, scpi: null, rent: null, interest: null })
    expect(both.find((r) => r.month === '2026-03')?.received).toBe(6.5)
    // The current month carries what already landed and what is still forecast.
    expect(both[11]).toEqual({ month: '2026-11', received: 3, receivedCrypto: 0, dividends: 10, scpi: 0, rent: 0, interest: 0 })
    expect(both[22]).toMatchObject({ month: '2027-10', received: null, dividends: 21 })

    const past = incomeChartRows(forecast, received, 'past')
    expect(past.map((r) => r.month)).toEqual(both.slice(0, 12).map((r) => r.month))
    expect(past.every((r) => r.dividends === null)).toBe(true)

    const next = incomeChartRows(forecast, received, 'next')
    expect(next.map((r) => r.month)).toEqual(forecast.map((m) => m.month))
    expect(next.every((r) => r.received === null)).toBe(true)
  })

  it('keeps crypto rewards apart from share dividends on the received side', () => {
    const forecast = Array.from({ length: 12 }, (_, i) => month(i < 2 ? `2026-${11 + i}` : `2027-${String(i - 1).padStart(2, '0')}`))
    const received = [
      { receivedDate: '2026-06-05', amountEur: 26, accountType: 'PEA' },
      { receivedDate: '2026-06-30', amountEur: 0.4, accountType: 'CRYPTO' },
      { receivedDate: '2026-07-01', amountEur: 0.01, accountType: 'CRYPTO' },
    ] as ReceivedDividend[]

    const rows = incomeChartRows(forecast, received, 'past')

    expect(rows.find((r) => r.month === '2026-06')).toMatchObject({ received: 26, receivedCrypto: 0.4 })
    expect(rows.find((r) => r.month === '2026-07')).toMatchObject({ received: 0, receivedCrypto: 0.01 })
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
