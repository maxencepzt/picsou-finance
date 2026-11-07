import { describe, it, expect } from 'vitest'
import { capitalAfter, currentPace, financialAssets, fiTarget, snap, yearsToTarget } from './fi-math'

describe('fi-math', () => {
  it('targets expenses × 12 ÷ withdrawal rate', () => {
    expect(fiTarget(2250, 4)).toBe(675000)
  })

  it('compounds yearly, then adds a year of savings', () => {
    expect(capitalAfter(1000, 100, 10, 0)).toBe(1000)
    expect(capitalAfter(1000, 100, 10, 1)).toBeCloseTo(2300)
    expect(capitalAfter(1000, 100, 10, 2)).toBeCloseTo(3730)
  })

  it('counts the years until the target is reached', () => {
    expect(yearsToTarget(5000, 0, 5, 5000)).toBe(0)
    // 1 200 a year with no return: 10 years to 12 000.
    expect(yearsToTarget(0, 100, 0, 12000)).toBe(10)
    expect(yearsToTarget(1000, 100, 10, 3730)).toBe(2)
  })

  it('answers null when the target is out of reach within the horizon', () => {
    expect(yearsToTarget(0, 0, 5, 100000)).toBeNull()
  })

  it('counts financial assets only, leaving out property, SCPI, debts and overdrafts', () => {
    expect(
      financialAssets([
        { accountType: 'CHECKING', balanceEur: 1000 },
        { accountType: 'LIVRET_A', balanceEur: 2000 },
        { accountType: 'PEA', balanceEur: 3000 },
        { accountType: 'CRYPTO', balanceEur: 400 },
        { accountType: 'ASSURANCE_VIE', balanceEur: 600 },
        { accountType: 'REAL_ESTATE', balanceEur: 200000 },
        { accountType: 'SCPI', balanceEur: 10000 },
        { accountType: 'LOAN', balanceEur: -150000 },
        { accountType: 'CHECKING', balanceEur: -50 },
      ]),
    ).toBe(7000)
  })

  it('takes the stated savings capacity, else the cycle net, never a negative pace', () => {
    expect(currentPace(750, 1200)).toBe(750)
    expect(currentPace(null, 1200)).toBe(1200)
    expect(currentPace(undefined, -300)).toBe(0)
    expect(currentPace(null, undefined)).toBe(0)
  })

  it('snaps a value onto the slider grid', () => {
    expect(snap(733, 0, 3000, 50)).toBe(750)
    expect(snap(-20, 0, 3000, 50)).toBe(0)
    expect(snap(4200, 0, 3000, 50)).toBe(3000)
  })
})
