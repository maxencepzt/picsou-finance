import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpcomingDividend } from '@/types/api'

const hooks = vi.hoisted(() => ({
  usePassiveIncome: vi.fn(),
  useReceivedDividends: vi.fn(),
  useAllocationTargets: vi.fn(),
}))

vi.mock('@/features/income/hooks', () => ({ usePassiveIncome: hooks.usePassiveIncome }))
vi.mock('@/features/dividends/hooks', () => ({ useReceivedDividends: hooks.useReceivedDividends }))
vi.mock('@/features/analysis/hooks', () => ({ useAllocationTargets: hooks.useAllocationTargets }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
vi.mock('@/components/shared/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ value }: { value: number }) => <span data-testid="currency">{value}</span>,
}))
vi.mock('@/components/shared/PageHeader', () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }))
vi.mock('./IncomeMonthsChart', () => ({ IncomeMonthsChart: () => null }))

const { IncomePage } = await import('./IncomePage')

const empty = { dividends: 0, scpi: 0, rent: 0, interest: 0 }
const months = Array.from({ length: 12 }, (_, i) => ({ month: `2027-${String(i + 1).padStart(2, '0')}`, ...empty }))

function renderPage() {
  return render(<MemoryRouter><IncomePage /></MemoryRouter>)
}

describe('IncomePage', () => {
  beforeEach(() => {
    hooks.useReceivedDividends.mockReturnValue({ data: [], isLoading: false })
    hooks.useAllocationTargets.mockReturnValue({ data: { monthlyEssentialExpenses: null } })
  })

  it('shows the empty state when nothing is projected or received', () => {
    hooks.usePassiveIncome.mockReturnValue({
      isLoading: false, isError: false, months, totals: { ...empty, total: 0 }, upcoming: [], savings: [], monthlyRent: 0,
    })
    renderPage()
    expect(screen.getByText('income.empty.title')).toBeInTheDocument()
  })

  it('keeps the page when the only credits have no exchange rate, and says they are not counted', () => {
    hooks.usePassiveIncome.mockReturnValue({
      isLoading: false, isError: false, months, totals: { ...empty, total: 0 }, upcoming: [], savings: [], monthlyRent: 0,
    })
    hooks.useReceivedDividends.mockReturnValue({
      data: [{ id: 'r', receivedDate: '2027-01-10', amount: 4, currency: 'GBP', amountEur: null }], isLoading: false,
    })
    renderPage()
    expect(screen.queryByText('income.empty.title')).toBeNull()
    expect(screen.getByText('income.months.unconverted')).toBeInTheDocument()
  })

  it('lists payers and points to Analyse when essential expenses are unknown', () => {
    const lvmh = {
      id: 'a', source: 'HOLDING', name: 'LVMH', expectedDate: '2027-03-02', paymentDate: '2027-03-04', amountEur: 52, cadence: 'ANNUAL',
    } as UpcomingDividend
    hooks.usePassiveIncome.mockReturnValue({
      isLoading: false, isError: false,
      months: months.map((m) => (m.month === '2027-03' ? { ...m, dividends: 52 } : m)),
      totals: { ...empty, dividends: 52, total: 52 },
      upcoming: [lvmh], savings: [], monthlyRent: 0,
    })
    renderPage()
    expect(screen.getAllByText('LVMH')).toHaveLength(2) // next payments + table
    expect(screen.getByText('income.hero.coverageUnknown')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'nav.analysis' })).toHaveAttribute('href', '/analysis')
  })
})
