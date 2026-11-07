import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { PortfolioLine } from '@/features/accounts/hooks'
import type { Account, FeesSummary, Performance } from '@/types/api'

const pea = { id: 1, name: 'PEA Bourso', type: 'PEA', currency: 'EUR', currentBalance: 100, currentBalanceEur: 100, openedAt: null } as Account
const cto = { id: 2, name: 'CTO', type: 'COMPTE_TITRES', currency: 'EUR', currentBalance: 50, currentBalanceEur: 50 } as Account
const base = { quantity: 1, accountColor: '#000', averageBuyIn: null, quoteCurrency: null, pnlPercent: 10, priceUpdatedAt: null }
const lines: PortfolioLine[] = [
  { ...base, id: '1-NVDA', name: 'NVIDIA', ticker: 'NVDA', accountId: 1, accountName: 'PEA Bourso', accountType: 'PEA', valueEur: 110, costBasisEur: 100, pnlEur: 10 },
  { ...base, id: '2-IWDA', name: 'iShares World', ticker: 'IWDA', accountId: 2, accountName: 'CTO', accountType: 'COMPTE_TITRES', valueEur: 55, costBasisEur: 50, pnlEur: 5 },
  { ...base, id: 'cash-aggregated', name: 'Euros', ticker: 'EUR', isCash: true, accountId: null, accountName: 'Courant', accountType: 'CHECKING', valueEur: 999, costBasisEur: null, pnlEur: null },
]
const year = new Date().getFullYear()

vi.mock('@/features/accounts/hooks', () => ({
  usePortfolio: () => ({ data: lines, isLoading: false, isError: false }),
  useAccounts: () => ({ data: [pea, cto] }),
}))
vi.mock('@/features/investments/hooks', () => ({
  useRealizedPnls: () => ({
    isLoading: false,
    data: [{ currency: 'EUR', realizedTotal: 0, byTicker: [], lots: [
      { ticker: 'AAPL', name: 'Apple', date: `${year}-02-01`, quantity: 1, avgCost: 1, proceeds: 1, realized: 40 },
      { ticker: 'TSLA', name: 'Tesla', date: `${year}-03-01`, quantity: 1, avgCost: 1, proceeds: 1, realized: -15 },
    ] }, undefined],
  }),
}))
const performance: Performance = {
  from: '2025-11-03', to: '2026-11-03', valueEur: 165, investedEur: 150,
  twrPercent: 8.42, annualizedPercent: null, xirrPercent: 7.9, volatilityPercent: null,
  maxDrawdownPercent: -9.8, maxDrawdownFrom: '2026-03-02', maxDrawdownTo: '2026-04-07',
  points: [
    { date: '2025-11-03', valueEur: 150, investedEur: 150, index: 100 },
    { date: '2026-11-03', valueEur: 165, investedEur: 150, index: 108.42 },
  ],
}
const fees: FeesSummary = {
  from: '2025-11-03', to: '2026-11-03', weightedTerPercent: 0.2, annualCostEur: 0.11,
  coveredValueEur: 55, totalValueEur: 165,
  lines: [
    { ticker: 'NVDA', name: 'NVIDIA', valueEur: 110, terPercent: null },
    { ticker: 'IWDA', name: 'iShares World', valueEur: 55, terPercent: 0.2 },
  ],
  brokerFeesEur: 4.5, brokerFeesCount: 3,
}
vi.mock('@/features/analysis/hooks', () => ({
  useDiversification: () => ({ data: undefined }),
  usePerformance: () => ({ data: performance, isLoading: false, isError: false }),
  useBenchmark: () => ({ data: undefined, isLoading: false, isError: false }),
  useFees: () => ({ data: fees, isLoading: false, isError: false }),
}))
vi.mock('@/features/dashboard/hooks', () => ({ useNetWorthIntraday: () => ({ data: undefined }) }))
// A non-EUR credit without a rate is left out of the total, not counted at par.
vi.mock('@/features/dividends/hooks', () => ({ useReceivedDividends: () => ({ data: [{ amountEur: 6 }, { amountEur: null }, { amountEur: 3.6 }] }) }))
vi.mock('@/features/history/hooks', () => ({ useHistory: () => ({ data: [] }) }))
vi.mock('@/components/shared/NetWorthChart', () => ({ NetWorthChart: () => null }))
vi.mock('@/pages/analysis/DiversificationSection', () => ({ DiversificationSection: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }))
vi.mock('@/components/shared/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ value }: { value: number }) => <span data-testid="currency">{value}</span>,
}))

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

const { InvestmentsPage } = await import('./InvestmentsPage')

describe('InvestmentsPage', () => {
  it('renders the portfolio without the bank cash, its realised gains and the missing PEA date', () => {
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText('NVIDIA')).toBeInTheDocument()
    expect(screen.queryByText('Euros')).not.toBeInTheDocument()
    // Hero value: 110 + 55, the 999 of bank cash left out.
    expect(screen.getAllByTestId('currency')[0]).toHaveTextContent('165')
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Tesla')).toBeInTheDocument()
    expect(screen.getByText('investments.tax.missing')).toBeInTheDocument()
  })

  it('totals the dividends in euros and says how many credits it had to leave out', () => {
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getAllByTestId('currency').map((el) => el.textContent)).toContain('9.6')
    expect(screen.getByText('investments.dividendsSkipped')).toBeInTheDocument()
  })

  it('shows the performance metrics, a dash with its reason for those that cannot be computed, and the fees', () => {
    render(<MemoryRouter><InvestmentsPage /></MemoryRouter>)

    expect(screen.getByText('investments.perf.twr')).toBeInTheDocument()
    expect(screen.getByText(/^\+8[.,]4\s?%$/)).toBeInTheDocument()
    // Annualised (under a year) and volatility (under 20 returns) are null: a dash and why, never 0.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('investments.perf.missing.year').length).toBeGreaterThan(0)
    expect(screen.getAllByText('investments.perf.missing.returns').length).toBeGreaterThan(0)
    expect(screen.getByText('investments.perf.drawdownDates')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'investments.benchmark.compareTo' })).toBeInTheDocument()

    expect(screen.getByText('investments.fees.coverage')).toBeInTheDocument()
    // Only the fund with a TER is ranked; the share has none.
    expect(screen.getByText('iShares World', { selector: '.truncate.font-medium' })).toBeInTheDocument()
    expect(screen.getByText('investments.fees.brokerCount')).toBeInTheDocument()
  })
})
