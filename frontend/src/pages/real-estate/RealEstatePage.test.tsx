import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Account, RealEstateSummary } from '@/types/api'

const hooks = vi.hoisted(() => ({ summary: vi.fn(), accounts: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }))
vi.mock('@/features/accounts/hooks', () => ({
  useRealEstateSummary: hooks.summary,
  useAccounts: hooks.accounts,
  usePropertyValuations: () => ({ data: [] }),
  useLoanSummary: () => ({ data: undefined, isLoading: false }),
}))
vi.mock('@/features/dashboard/hooks', () => ({
  useDashboard: () => ({ data: { totalNetWorth: 0, totalMonthlyPayment: null, liabilities: [] } }),
}))
vi.mock('@/features/profile/hooks', () => ({ useMemberProfile: () => ({ data: undefined, isLoading: false }) }))
vi.mock('@/components/shared/CurrencyDisplay', () => ({ CurrencyDisplay: ({ value }: { value: number }) => <span>{value}</span> }))
vi.mock('@/components/property/AddPropertyModal', () => ({ AddPropertyModal: () => null }))

import { RealEstatePage } from './RealEstatePage'

const empty: RealEstateSummary = {
  grossValue: 0, outstandingDebt: 0, netValue: 0, costBasis: 0, unrealizedGain: 0, unrealizedGainPercent: null,
  loanToValue: null, monthlyRentalIncome: 0, properties: [], paperGross: 0, paperDebt: 0, paperNet: 0, paper: [],
}

function renderPage(accounts: Partial<Account>[]) {
  hooks.summary.mockReturnValue({ data: empty, isLoading: false, isError: false })
  hooks.accounts.mockReturnValue({ data: accounts, isLoading: false })
  return render(<MemoryRouter><RealEstatePage /></MemoryRouter>)
}

describe('RealEstatePage', () => {
  it('shows both empty states and no KPI row when there is nothing to show', () => {
    renderPage([])
    expect(screen.getByText('realEstatePage.empty.properties')).toBeInTheDocument()
    expect(screen.getByText('dashboard.kpi.noLoan')).toBeInTheDocument()
    expect(screen.queryByText('realEstatePage.kpi.gross')).not.toBeInTheDocument()
  })

  it('renders a loan without terms from its balance', () => {
    renderPage([{ id: 7, name: 'Prêt auto', type: 'LOAN', hidden: false, currentBalanceEur: -8500, provider: 'Cetelem' }])
    expect(screen.queryByText('dashboard.kpi.noLoan')).not.toBeInTheDocument()
    expect(screen.getByText('Prêt auto')).toBeInTheDocument()
    expect(screen.getByText('8500')).toBeInTheDocument()
    expect(screen.getByText('dashboard.loanParamsUnconfigured')).toBeInTheDocument()
  })
})
