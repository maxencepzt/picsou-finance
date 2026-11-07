import { describe, expect, it } from 'vitest'
import type { LoanInstallment } from '@/types/api'
import { debtToIncome, loanInterest, monthYear } from './real-estate'

const row = (number: number, interest: number): LoanInstallment => ({
  number, date: `2024-${String(number).padStart(2, '0')}-01`, capital: 100, interest, insurance: 0, totalPayment: 100 + interest, remainingBalance: 0,
})

describe('loanInterest', () => {
  it('sums every row for the total and only the unpaid rows for the remainder', () => {
    const schedule = [row(1, 50), row(2, 40), row(3, 30), row(4, 20)]
    expect(loanInterest(schedule, 2)).toEqual({ total: 140, remaining: 50 })
  })

  it('owes everything before the first payment and nothing once paid off', () => {
    const schedule = [row(1, 10), row(2, 5)]
    expect(loanInterest(schedule, 0).remaining).toBe(15)
    expect(loanInterest(schedule, 2).remaining).toBe(0)
    expect(loanInterest([], 0)).toEqual({ total: 0, remaining: 0 })
  })
})

describe('debtToIncome', () => {
  it('is null when no income is declared', () => {
    expect(debtToIncome(1000, null)).toBeNull()
    expect(debtToIncome(1000, undefined)).toBeNull()
    expect(debtToIncome(1000, 0)).toBeNull()
  })

  it('places the ratio and the 35 % mark on a 0–60 % gauge', () => {
    const dti = debtToIncome(900, 3000)!
    expect(dti.percent).toBeCloseTo(30)
    expect(dti.over).toBe(false)
    expect(dti.scale).toBe(60)
    expect(dti.fill).toBeCloseTo(50)
    expect(dti.mark).toBeCloseTo(58.33, 1)
  })

  it('flags a ratio above the threshold, not one exactly at it', () => {
    expect(debtToIncome(1050, 3000)!.over).toBe(false)
    expect(debtToIncome(1337.49, 3200)!.over).toBe(true)
  })

  it('stretches the gauge past 60 % so the bar never overflows', () => {
    const dti = debtToIncome(2400, 3000)!
    expect(dti.scale).toBeCloseTo(80)
    expect(dti.fill).toBeCloseTo(100)
    expect(dti.mark).toBeCloseTo(43.75)
  })
})

describe('monthYear', () => {
  it('keeps the month of a date-only string whatever the time zone', () => {
    expect(monthYear('2023-06-01', 'en-US')).toBe('June 2023')
  })
})
