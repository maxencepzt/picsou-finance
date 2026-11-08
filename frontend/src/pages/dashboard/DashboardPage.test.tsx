import '@testing-library/jest-dom'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardData } from '@/types/api'

const allocationCardSpy = vi.hoisted(() => vi.fn<(props: { distribution: unknown[] }) => null>(() => null))

const hooks = vi.hoisted(() => ({
  useDashboard: vi.fn(),
  useNetWorthIntraday: vi.fn(),
  usePnl: vi.fn(),
  useHistory: vi.fn(),
  useBankSyncStatus: vi.fn(),
}))

vi.mock('@/features/dashboard/hooks', () => ({
  useDashboard: hooks.useDashboard,
  useNetWorthIntraday: hooks.useNetWorthIntraday,
  usePnl: hooks.usePnl,
}))
vi.mock('@/features/history/hooks', () => ({ useHistory: hooks.useHistory }))
vi.mock('@/features/sync/hooks', () => ({ useBankSyncStatus: hooks.useBankSyncStatus }))
vi.mock('@/features/budget/hooks', () => ({ useCashflow: () => ({ data: undefined }) }))
vi.mock('@/features/income/hooks', () => ({ usePassiveIncome: () => ({ totals: { total: 0 } }) }))
vi.mock('./AllocationCard', () => ({ AllocationCard: allocationCardSpy }))
vi.mock('./AttentionCard', () => ({ AttentionCard: () => null }))
vi.mock('./GoalsCard', () => ({ GoalsCard: () => null }))
vi.mock('./HealthCard', () => ({ HealthCard: () => null }))
vi.mock('./LiquidityCard', () => ({ LiquidityCard: () => null }))
vi.mock('./MoversCard', () => ({ MoversCard: () => null }))
vi.mock('./PeersCard', () => ({ PeersCard: () => null }))
vi.mock('./UpcomingCard', () => ({ UpcomingCard: () => null }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'goals.noData' ? '—' : key,
  }),
}))
vi.mock('@/components/shared/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ value }: { value: number }) => <span data-testid="currency">{value}</span>,
}))
vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: ReactNode }) => <header><h1>{title}</h1>{actions}</header>,
}))
vi.mock('@/components/shared/NetWorthChart', () => ({ NetWorthChart: () => null }))
// The period switch now sits in the card header; its scroll strip needs a ResizeObserver jsdom lacks.
vi.mock('@/components/shared/TimeRangeSelector', () => ({ TimeRangeSelector: () => null }))
vi.mock('@/components/shared/DistributionPie', () => ({ DistributionPie: () => null }))
vi.mock('@/components/shared/LoadingSkeleton', () => ({ LoadingSkeleton: () => null }))
vi.mock('@/components/shared/HoldingsCard', () => ({ HoldingsCard: () => null }))
vi.mock('@/components/shared/LiabilitiesCard', () => ({ LiabilitiesCard: () => null }))
vi.mock('@/components/sync/SyncAllModal', () => ({ SyncAllModal: () => null }))
vi.mock('@/pages/goals/GoalDetailModal', () => ({ GoalDetailModal: () => null }))
vi.mock('@/components/ui/card', () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    Card: Part,
    CardContent: Part,
    CardDescription: Part,
    CardFooter: Part,
    CardHeader: Part,
    CardTitle: Part,
    CardAction: Part,
  }
})
vi.mock('@/components/ui/dropdown-menu', () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return {
    DropdownMenu: Part,
    DropdownMenuContent: Part,
    DropdownMenuItem: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => (
      <button onClick={onClick}>{children}</button>
    ),
    DropdownMenuTrigger: Part,
  }
})
vi.mock('@/components/ui/item', () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>
  return { Item: Part, ItemContent: Part, ItemDescription: Part, ItemFooter: Part, ItemGroup: Part }
})
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
}))
vi.mock('@/components/ui/progress', () => ({ Progress: () => null }))

const { DashboardPage } = await import('./DashboardPage')

const DASHBOARD_DATA: DashboardData = {
  totalNetWorth: 1200,
  totalLiabilities: 0,
  netWorthHistory: [],
  distribution: [],
  assets: [],
  liabilities: [],
  goalSummaries: [],
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

describe('DashboardPage portfolio performance', () => {
  beforeEach(() => {
    hooks.useDashboard.mockReturnValue({ data: DASHBOARD_DATA, isLoading: false })
    hooks.useNetWorthIntraday.mockReturnValue({ data: [] })
    hooks.usePnl.mockReturnValue({
      data: {
        total: 1200,
        invested: null,
        pnl: null,
        pnlPercent: null,
        valueAtFrom: 1200,
        rangePnl: null,
        rangePnlPercent: null,
      },
    })
    hooks.useHistory.mockReturnValue({ data: [] })
    hooks.useBankSyncStatus.mockReturnValue({ data: [] })
  })

  it('shows unavailable performance instead of zero when the selected range has unknown PnL', () => {
    renderDashboard()

    const row = screen.getByText('dashboard.portfolioPerformance', { exact: false })
    expect(row).toHaveTextContent('—')
    expect(row.querySelector('[data-testid="currency"]')).toBeNull()
    expect(row.querySelector('svg')).toBeNull()
  })

  it('does not substitute known live PnL when the selected range PnL is unknown', () => {
    hooks.usePnl.mockReturnValue({
      data: {
        total: 1200,
        invested: 1000,
        pnl: 200,
        pnlPercent: 20,
        valueAtFrom: null,
        rangePnl: null,
        rangePnlPercent: null,
      },
    })

    renderDashboard()

    const row = screen.getByText('dashboard.portfolioPerformance', { exact: false })
    expect(row).toHaveTextContent('—')
    expect(row.querySelector('[data-testid="currency"]')).toBeNull()
  })

  it('keeps a known zero range PnL as zero', () => {
    hooks.usePnl.mockReturnValue({
      data: {
        total: 1200,
        invested: 1200,
        pnl: 0,
        pnlPercent: 0,
        valueAtFrom: 1200,
        rangePnl: 0,
        rangePnlPercent: 0,
      },
    })

    renderDashboard()

    // A known P&L is a Delta whose trailing words are the label: the row is the Delta around them.
    const row = screen.getByText('dashboard.portfolioPerformance', { exact: false }).parentElement!
    expect(row.querySelector('[data-testid="currency"]')).toHaveTextContent('0')
    expect(row).toHaveTextContent('(0.0%)')
    // A zero change is neutral: no up or down arrow.
    expect(row.querySelector('svg')).toBeNull()
  })
})

describe('DashboardPage financial wealth mode', () => {
  const FINANCIAL_ACCOUNTS: DashboardData['distribution'] = [
      { accountId: 1, name: 'Livret', color: '#1', balanceEur: 1000, percentage: 0, accountType: 'SAVINGS', hasHoldings: false },
      { accountId: 2, name: 'Appart', color: '#2', balanceEur: 215000, percentage: 0, accountType: 'REAL_ESTATE', hasHoldings: true },
      { accountId: 3, name: 'Courant', color: '#3', balanceEur: 300, percentage: 0, accountType: 'CHECKING', hasHoldings: false },
      { accountId: 4, name: 'SCPI Rendement', color: '#4', balanceEur: 2000, percentage: 0, accountType: 'SCPI', hasHoldings: true },
      { accountId: 5, name: 'Divers', color: '#5', balanceEur: 500, percentage: 0, accountType: 'OTHER', hasHoldings: false },
      { accountId: 6, name: 'Napoleon', color: '#6', balanceEur: 700, percentage: 0, accountType: 'PRECIOUS_METALS', hasHoldings: false },
  ]
  const FINANCIAL_DATA: DashboardData = {
    totalNetWorth: 219500,
    totalLiabilities: 0,
    netWorthHistory: [],
    distribution: FINANCIAL_ACCOUNTS,
    assets: FINANCIAL_ACCOUNTS,
    liabilities: [],
    goalSummaries: [],
  }

  beforeEach(() => {
    hooks.useDashboard.mockReturnValue({ data: FINANCIAL_DATA, isLoading: false })
    hooks.useNetWorthIntraday.mockReturnValue({ data: [] })
    hooks.usePnl.mockReturnValue({
      data: {
        total: 219500,
        invested: null,
        pnl: null,
        pnlPercent: null,
        valueAtFrom: 219500,
        rangePnl: null,
        rangePnlPercent: null,
      },
    })
    hooks.useHistory.mockReturnValue({ data: [] })
    hooks.useBankSyncStatus.mockReturnValue({ data: [] })
    allocationCardSpy.mockClear()
  })

  function switchToFinancialWealth() {
    renderDashboard()
    fireEvent.click(screen.getByText('dashboard.financialWorth'))
  }

  it('excludes real estate, checking, other and metals from the headline value but keeps SCPI', () => {
    switchToFinancialWealth()

    // The hero figure is the first amount on screen, before the KPI row.
    expect(screen.getAllByTestId('currency')[0]).toHaveTextContent('3000')
  })

  it('feeds only financial accounts to the history curve', () => {
    switchToFinancialWealth()

    // The month-change KPI reads every account; the curve is the call with the mode's accounts.
    expect(hooks.useHistory.mock.calls.map(call => call[0])).toContainEqual([1, 4])
  })

  it('feeds only financial holding accounts to the PnL', () => {
    switchToFinancialWealth()

    const lastCall = hooks.usePnl.mock.calls.at(-1)
    expect(lastCall?.[0]).toEqual([4])
  })

  it('hides non-financial accounts from the allocation card', () => {
    hooks.useDashboard.mockReturnValue({
      data: {
        ...FINANCIAL_DATA,
        distribution: FINANCIAL_DATA.distribution.map(item => ({
          ...item,
          percentage: (item.balanceEur / 219500) * 100,
        })),
      },
      isLoading: false,
    })
    switchToFinancialWealth()

    const props = allocationCardSpy.mock.calls.at(-1)?.[0] as {
      distribution: { accountId: number; percentage: number }[]
    }
    expect(props.distribution.map(d => d.accountId)).toEqual([1, 4])
    expect(props.distribution[0]?.percentage).toBeCloseTo(33.3, 1)
    expect(props.distribution[1]?.percentage).toBeCloseTo(66.7, 1)
  })
})
