import { describe, expect, it } from 'vitest'
import type { Account } from '@/types/api'
import { accountCeiling, ceilingUsage, PEA_DEFAULT_DEPOSIT_CEILING } from './ceiling'

type CeilingAccount = Parameters<typeof accountCeiling>[0]
const livret = (balance: number, ceiling: number | null): CeilingAccount => ({
  type: 'SAVINGS', currentBalanceEur: balance,
  savingsConfig: { product: 'LIVRET_A', annualRate: 2.4, rateBasis: 'NET', taxRatePct: null, ceiling },
})
const pea = (extra: Partial<Account> = {}): CeilingAccount => ({ type: 'PEA', currentBalanceEur: 9000, ...extra })

describe('ceilingUsage', () => {
  it('reads empty, partial, near and full', () => {
    expect(ceilingUsage(0, 22950, 'balance')).toMatchObject({ pct: 0, remaining: 22950, state: 'ok' })
    expect(ceilingUsage(5000, 22950, 'balance')).toMatchObject({ remaining: 17950, state: 'ok' })
    expect(ceilingUsage(18360, 22950, 'balance').state).toBe('warning') // exactly 80 %
    expect(ceilingUsage(22950, 22950, 'balance')).toMatchObject({ pct: 100, remaining: 0, state: 'full' })
  })

  it('keeps the real percentage past the ceiling and never a negative room', () => {
    expect(ceilingUsage(23868, 22950, 'balance')).toMatchObject({ pct: 104, remaining: 0, state: 'full' })
  })
})

describe('accountCeiling', () => {
  it('measures a livret balance against its configured ceiling', () => {
    expect(accountCeiling(livret(5000, 22950))).toMatchObject({ used: 5000, ceiling: 22950, kind: 'balance' })
  })

  it('returns nothing without a ceiling', () => {
    expect(accountCeiling(livret(5000, null))).toBeNull()
    expect(accountCeiling({ type: 'CHECKING', currentBalanceEur: 300 })).toBeNull()
  })

  it('measures a PEA contributions against the legal default, or the stated ceiling', () => {
    expect(accountCeiling(pea({ investedEur: 7500 }))).toMatchObject({
      used: 7500, ceiling: PEA_DEFAULT_DEPOSIT_CEILING, pct: 5, kind: 'deposits',
    })
    expect(accountCeiling(pea({ investedEur: 7500, depositCeiling: 20000 }))).toMatchObject({ ceiling: 20000, pct: 37.5 })
  })

  it('prefers the cost basis the page shows, and needs one', () => {
    expect(accountCeiling(pea({ investedEur: 7500, depositCeiling: 20000 }), 16000)).toMatchObject({ used: 16000, state: 'warning' })
    expect(accountCeiling(pea())).toBeNull()
  })
})
