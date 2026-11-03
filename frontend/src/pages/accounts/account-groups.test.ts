import { describe, expect, it } from 'vitest'
import type { Account, AccountType } from '@/types/api'
import { accountFreshness, accountKpis, groupByAssetClass, groupByInstitution, monthChange } from './account-groups'

const NOW = Date.parse('2026-11-03T12:00:00Z')

function account(id: number, type: AccountType, balance: number, extra: Partial<Account> = {}): Account {
  return {
    id, name: `A${id}`, type, provider: null, currency: 'EUR', currentBalance: balance, currentBalanceEur: balance,
    lastSyncedAt: null, isManual: true, color: '#000', ticker: null, logoUrl: null, logoKey: null,
    createdAt: '2026-01-01T00:00:00Z', hidden: false, ...extra,
  }
}

describe('groupByAssetClass', () => {
  it('orders groups by class, puts debts last and sums them negative', () => {
    const groups = groupByAssetClass([
      { account: account(1, 'LOAN', 1000), pockets: [] },
      { account: account(2, 'PEA', 500), pockets: [] },
      { account: account(3, 'CHECKING', 200), pockets: [account(4, 'CHECKING', 50)] },
      { account: account(5, 'CREDIT_CARD', -300), pockets: [] },
      { account: account(6, 'CHECKING', 900), pockets: [] },
    ])
    expect(groups.map((g) => g.key)).toEqual(['cash', 'equity', 'debts'])
    // The pocket is inside its wallet's balance: not counted twice.
    expect(groups[0].total).toBe(1100)
    expect(groups[0].items.map((i) => i.account.id)).toEqual([6, 3])
    expect(groups[2].total).toBe(-1300)
    expect(groups[2].items.map((i) => i.account.id)).toEqual([1, 5])
  })
})

describe('groupByInstitution', () => {
  it('groups by provider, nets each bank, then the accounts with no institution and the properties', () => {
    const groups = groupByInstitution([
      { account: account(1, 'CHECKING', 2000, { provider: 'BNP Paribas', isManual: false }), pockets: [] },
      { account: account(2, 'LOAN', 1500, { provider: ' bnp paribas ' }), pockets: [] },
      { account: account(3, 'PEA', 4000, { provider: 'BoursoBank', isManual: false }), pockets: [] },
      { account: account(4, 'CHECKING', 300, { provider: 'Revolut', isManual: false }), pockets: [account(5, 'CHECKING', 100, { provider: 'Revolut' })] },
      { account: account(6, 'OTHER', 800), pockets: [] },
      { account: account(7, 'REAL_ESTATE', 250000), pockets: [] },
      { account: account(8, 'LIVRET_A', 1000, { provider: 'BNP Paribas', isManual: false }), pockets: [] },
    ])
    expect(groups.map((g) => g.key)).toEqual(['bank:boursobank', 'bank:bnp paribas', 'bank:revolut', 'manual', 'property'])
    // A hand-typed loan stays with its bank, spelling and case aside: 2000 + 1000 − 1500.
    expect(groups[1]).toMatchObject({ label: 'BNP Paribas', total: 1500 })
    expect(groups[1].items.map((i) => i.account.id)).toEqual([1, 2, 8])
    // The pocket is already inside the wallet's balance.
    expect(groups[2].total).toBe(300)
    expect(groups[3]).toMatchObject({ label: null, total: 800 })
    expect(groups[4]).toMatchObject({ label: null, total: 250000 })
  })
})

describe('accountKpis', () => {
  it('splits assets from debts and counts synced accounts refreshed within a day', () => {
    const kpis = accountKpis([
      account(1, 'CHECKING', 1000, { isManual: false, lastSyncedAt: '2026-11-03T08:00:00Z' }),
      account(2, 'PEA', 4000, { isManual: false, lastSyncedAt: '2026-10-20T08:00:00Z' }),
      account(3, 'LOAN', 2500),
      account(4, 'CREDIT_CARD', -100, { isManual: false, lastSyncedAt: null }),
    ], NOW)
    expect(kpis).toEqual({ assets: 5000, debts: 2600, count: 4, manual: 1, synced: 3, upToDate: 1 })
  })
})

describe('monthChange', () => {
  it('compares the latest snapshot with the last one a month or more before it', () => {
    const change = monthChange([
      { date: '2026-11-03', balance: 1100 },
      { date: '2026-09-30', balance: 900 },
      { date: '2026-10-03', balance: 1000 },
      { date: '2026-10-20', balance: 1050 },
    ])
    expect(change).toEqual({ amount: 100, percent: 10 })
  })

  it('handles January and month-end days', () => {
    expect(monthChange([{ date: '2026-01-31', balance: 50 }, { date: '2025-12-31', balance: 100 }]))
      .toEqual({ amount: -50, percent: -50 })
    expect(monthChange([{ date: '2026-03-31', balance: 3 }, { date: '2026-02-28', balance: 2 }])?.amount).toBe(1)
  })

  it('stays silent when the history is shorter than a month, and gives no percent from zero', () => {
    expect(monthChange([{ date: '2026-11-03', balance: 1 }, { date: '2026-10-20', balance: 2 }])).toBeNull()
    expect(monthChange([{ date: '2026-11-03', balance: 5 }, { date: '2026-10-01', balance: 0 }])).toEqual({ amount: 5, percent: null })
  })
})

describe('accountFreshness', () => {
  it('grades a property on its valuation date and never warns about a manual figure', () => {
    const property = account(1, 'REAL_ESTATE', 1, { realEstate: { lastValuedAt: '2026-10-20T00:00:00Z' } as Account['realEstate'] })
    expect(accountFreshness(property, NOW)).toMatchObject({ level: 'fresh', valuation: true, warn: false })
    expect(accountFreshness(account(2, 'CHECKING', 1, { isManual: false, lastSyncedAt: '2026-10-20T00:00:00Z' }), NOW))
      .toMatchObject({ level: 'old', valuation: false, warn: true })
    expect(accountFreshness(account(3, 'CHECKING', 1), NOW)).toBeNull()
  })
})
