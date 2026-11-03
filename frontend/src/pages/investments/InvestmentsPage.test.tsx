import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { PortfolioLine } from '@/features/accounts/hooks'
import type { Account } from '@/types/api'

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
vi.mock('@/features/analysis/hooks', () => ({ useDiversification: () => ({ data: undefined }) }))
vi.mock('@/features/dashboard/hooks', () => ({ useNetWorthIntraday: () => ({ data: undefined }) }))
vi.mock('@/features/dividends/hooks', () => ({ useReceivedDividends: () => ({ data: [] }) }))
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
})
