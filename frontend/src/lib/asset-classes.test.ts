import { describe, expect, it } from 'vitest'
import { ASSET_CLASS_ORDER, LIQUIDITY_ORDER, assetClassOf, liquidityOf, sumBy } from './asset-classes'

describe('asset classes', () => {
  it('maps every account type, liabilities to nothing', () => {
    expect(assetClassOf('LIVRET_A')).toBe('savings')
    expect(assetClassOf('PEA')).toBe('equity')
    expect(assetClassOf('ASSURANCE_VIE')).toBe('funds')
    expect(assetClassOf('LOAN')).toBeNull()
    expect(assetClassOf('CREDIT_CARD')).toBeNull()
  })

  it('counts a PEA as locked money and property as illiquid', () => {
    expect(liquidityOf('PEA')).toBe('locked')
    expect(liquidityOf('COMPTE_TITRES')).toBe('market')
    expect(liquidityOf('CHECKING')).toBe('available')
    expect(liquidityOf('SCPI')).toBe('illiquid')
    expect(liquidityOf('LOAN')).toBeNull()
  })

  it('sums positive balances per key in display order, skipping liabilities and empty classes', () => {
    const rows = [
      { type: 'REAL_ESTATE' as const, amount: 412000 },
      { type: 'CHECKING' as const, amount: 2340 },
      { type: 'LIVRET_A' as const, amount: 5120 },
      { type: 'LEP' as const, amount: 7800 },
      { type: 'LOAN' as const, amount: 168400 },
      { type: 'CHECKING' as const, amount: -12 },
    ]
    expect(sumBy(rows, assetClassOf, ASSET_CLASS_ORDER)).toEqual([
      { key: 'cash', amount: 2340 },
      { key: 'savings', amount: 12920 },
      { key: 'realestate', amount: 412000 },
    ])
    expect(sumBy(rows, liquidityOf, LIQUIDITY_ORDER).map((r) => r.key)).toEqual(['available', 'illiquid'])
  })
})
