import { describe, expect, it } from 'vitest'
import type { PortfolioLine } from '@/features/accounts/hooks'
import type { RealizedLot } from '@/types/api'
import {
  concentration, currencySplit, eurRate, investmentLines, maturity, portfolioTotals,
  realizedInYear, realizedYears, wrapperOf, type RealizedSource,
} from './investments'

function line(over: Partial<PortfolioLine>): PortfolioLine {
  return {
    id: over.ticker ?? 'x', name: over.ticker ?? 'x', ticker: null, quantity: 1, accountId: 1, accountName: 'PEA',
    accountType: 'PEA', accountColor: '#000', valueEur: 0, costBasisEur: null, averageBuyIn: null,
    quoteCurrency: null, pnlEur: null, pnlPercent: null, priceUpdatedAt: null, ...over,
  }
}

function lot(date: string, ticker: string, realized: number): RealizedLot {
  return { ticker, name: ticker, date, quantity: 1, avgCost: 0, proceeds: 0, realized }
}

describe('positions', () => {
  it('keeps investment wrappers only and groups the rest as other', () => {
    const lines = [line({ ticker: 'A' }), line({ id: 'cash-aggregated', accountType: 'CHECKING' }), line({ ticker: 'B', accountType: 'PER' })]
    expect(investmentLines(lines).map((l) => l.ticker)).toEqual(['A', 'B'])
    expect(['PEA', 'COMPTE_TITRES', 'CRYPTO', 'PER', 'ASSURANCE_VIE'].map((t) => wrapperOf(t as never)))
      .toEqual(['PEA', 'COMPTE_TITRES', 'CRYPTO', 'other', 'other'])
  })

  it('totals value and unrealised gain over the lines whose cost is known', () => {
    const totals = portfolioTotals([
      line({ valueEur: 120, costBasisEur: 100, pnlEur: 20 }),
      line({ valueEur: 50, costBasisEur: null, pnlEur: null }),
    ])
    expect(totals).toEqual({ value: 170, invested: 100, pnl: 20, pnlPercent: 20 })
    expect(portfolioTotals([]).pnlPercent).toBeNull()
  })
})

describe('concentration', () => {
  it('merges one ticker across wrappers and measures the top three', () => {
    const result = concentration([
      line({ id: '1-NVDA', ticker: 'NVDA', valueEur: 30 }),
      line({ id: '2-NVDA', ticker: 'NVDA', valueEur: 10, accountType: 'COMPTE_TITRES' }),
      line({ ticker: 'AAPL', valueEur: 20 }),
      line({ ticker: 'MSFT', valueEur: 20 }),
      line({ ticker: 'BTC', valueEur: 20 }),
    ])!
    expect(result.topCount).toBe(3)
    expect(result.topShare).toBeCloseTo(80)
    expect(result.largest.ticker).toBe('NVDA')
    expect(result.largestShare).toBeCloseTo(40)
  })

  it('has nothing to say about an empty portfolio', () => {
    expect(concentration([])).toBeNull()
  })

  it('splits by quote currency, euros when unknown', () => {
    expect(currencySplit([
      line({ quoteCurrency: 'USD', valueEur: 75 }),
      line({ quoteCurrency: null, valueEur: 20 }),
      line({ quoteCurrency: 'EUR', valueEur: 5 }),
      // A live EUR price overwrote the quote currency; the listing currency still says USD.
      line({ quoteCurrency: 'EUR', listingCurrency: 'USD', valueEur: 10 }),
    ])).toEqual([{ currency: 'USD', amount: 85, share: 85 / 1.1 }, { currency: 'EUR', amount: 25, share: 25 / 1.1 }])
  })
})

describe('realised gains', () => {
  const sources: RealizedSource[] = [
    { accountId: 1, accountName: 'PEA', accountType: 'PEA', rate: 1, lots: [
      lot('2026-02-01', 'NVDA', 300), lot('2026-05-01', 'NVDA', 88), lot('2026-06-01', 'ETH', -172), lot('2025-03-01', 'AAPL', 50),
    ] },
    { accountId: 2, accountName: 'Kraken', accountType: 'CRYPTO', rate: 0.5, lots: [lot('2026-07-01', 'SOL', 508)] },
  ]

  it('lists the years with a sale', () => {
    expect(realizedYears(sources)).toEqual([2025, 2026])
  })

  it('nets each position over the year, in euros, gains apart from losses', () => {
    const year = realizedInYear(sources, 2026)
    expect(year.gains.map((p) => [p.key, p.amount])).toEqual([['1-NVDA', 388], ['2-SOL', 254]])
    expect(year.losses.map((p) => [p.key, p.amount])).toEqual([['1-ETH', -172]])
    expect(year).toMatchObject({ gainTotal: 642, lossTotal: -172, net: 470, sales: 4 })
  })

  it('reads a rate off the balance of a foreign-currency account', () => {
    expect(eurRate({ currency: 'USD', currentBalance: 200, currentBalanceEur: 180 })).toBeCloseTo(0.9)
    expect(eurRate({ currency: 'EUR', currentBalance: 200, currentBalanceEur: 200 })).toBe(1)
    expect(eurRate({ currency: 'USD', currentBalance: 0, currentBalanceEur: 0 })).toBe(1)
  })
})

describe('maturity', () => {
  const now = new Date(2026, 10, 3) // 3 Nov 2026

  it('counts whole months toward five years for a PEA', () => {
    expect(maturity({ type: 'PEA', openedAt: '2022-06-15' }, now)).toEqual({
      thresholdYears: 5, years: 4, months: 4, progress: (52 / 60) * 100, maturityDate: '2027-06-15', reached: false,
    })
  })

  it('caps at the threshold once an assurance vie is eight', () => {
    const result = maturity({ type: 'ASSURANCE_VIE', openedAt: '2014-03-12' }, now)!
    expect(result).toMatchObject({ thresholdYears: 8, years: 12, progress: 100, maturityDate: '2022-03-12', reached: true })
  })

  it('is reached on the anniversary day', () => {
    expect(maturity({ type: 'PEA', openedAt: '2021-11-03' }, now)!.reached).toBe(true)
    expect(maturity({ type: 'PEA', openedAt: '2021-11-04' }, now)!.reached).toBe(false)
  })

  it('cannot say without an opening date or for another wrapper', () => {
    expect(maturity({ type: 'PEA', openedAt: null }, now)).toBeNull()
    expect(maturity({ type: 'COMPTE_TITRES', openedAt: '2020-01-01' }, now)).toBeNull()
  })
})
