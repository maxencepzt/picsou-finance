import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import type { Account, PeerLoansOverview, RealEstateMetadata } from '@/types/api'
import type { NetWorthPoint } from '@/features/history/api'

const useAccounts = vi.fn()
const useHistory = vi.fn()
const usePeerLoansOverview = vi.fn<() => { data: PeerLoansOverview | undefined }>(() => ({ data: undefined }))
const useSavingsSuggestions = vi.fn<() => { data: Array<{ accountId: number; accountName: string; suggestedProduct: string; defaultAnnualRate: number }> | undefined }>(() => ({ data: undefined }))
const navigateMock = vi.fn()
const orderMutate = vi.fn()
const collapseMutate = vi.fn()

vi.mock('@/features/accounts/hooks', async (importActual) => ({
  // useAccountTree is a pure useMemo over the accounts handed in -- it groups Revolut pockets
  // under their wallet. Stubbing it would stub out the grouping these cases render through, so
  // the real one stays and only the query hooks are replaced.
  ...(await importActual<typeof import('@/features/accounts/hooks')>()),
  useAccounts: () => useAccounts(),
  // Reads the budget settings query, which has no client in this test and nothing to say here.
  useInstitutionLogoUrl: () => () => null,
  useAccountDeletionImpact: () => ({ data: undefined }),
  useUpdateAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAccount: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateDebtMetadata: () => ({ mutate: vi.fn(), isPending: false }),
  useSetDisplayOrder: () => ({ mutate: orderMutate, isPending: false }),
  useSetListCollapsed: () => ({ mutate: collapseMutate, isPending: false }),
}))

// The savings-suggestion banner is a query of its own and has nothing to say about gain/loss.
vi.mock('@/features/savings/hooks', () => ({
  useSavingsSuggestions: () => useSavingsSuggestions(),
}))

vi.mock('@/features/history/hooks', () => ({
  useHistory: () => useHistory(),
}))

// The closed-loan filter is a query of its own; it has nothing to say about gain/loss.
vi.mock('@/features/peer-loans/hooks', () => ({
  usePeerLoansOverview: () => usePeerLoansOverview(),
}))

// The form and the two add-account modals drag in zod and the whole connector catalog. They
// are never opened here, so stubbing them keeps this suite about the summary card.
vi.mock('@/components/shared/AccountForm', () => ({
  AccountForm: ({ open, defaultValues, onOpenChange }: { open: boolean; defaultValues?: { name?: string }; onOpenChange: (open: boolean) => void }) =>
    open ? <div data-testid="edit-form">{defaultValues?.name}<button onClick={() => onOpenChange(false)}>close-form</button></div> : null,
}))
// The panel reads the detail page's queries; its own content is not what these cases are about.
vi.mock('./AccountPanel', () => ({
  AccountPanel: ({ account }: { account: Account | null }) => (account ? <div data-testid="panel">{account.name}</div> : null),
}))
vi.mock('@/components/shared/AddAccountModal', () => ({ AddAccountModal: () => null }))
vi.mock('@/components/property/AddPropertyModal', () => ({ AddPropertyModal: () => null }))
vi.mock('@/components/shared/AccountsStackedChart', () => ({
  AccountsStackedChart: ({ data }: { data: { date: string; [key: string]: string | number }[] }) => (
    <div data-testid="pnl-chart" data-chart={JSON.stringify(data)} />
  ),
}))

vi.mock('react-router', async (importActual) => ({
  ...(await importActual<typeof import('react-router')>()),
  useNavigate: () => navigateMock,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'fr', language: 'fr' },
  }),
}))

vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})

const { AccountsPage } = await import('./AccountsPage')

function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}

function renderPage(path = '/accounts') {
  return render(<MemoryRouter initialEntries={[path]}><AccountsPage /><Search /></MemoryRouter>)
}

function property(id: number, balanceEur: number, costBasis?: number): Account {
  return {
    id,
    name: `Bien ${id}`,
    type: 'REAL_ESTATE',
    provider: null,
    currency: 'EUR',
    currentBalance: balanceEur,
    currentBalanceEur: balanceEur,
    lastSyncedAt: null,
    isManual: true,
    color: '#a855f7',
    ticker: null,
    logoUrl: null,
    logoKey: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...(costBasis == null
      ? {}
      : { realEstate: { costBasis, purchasePrice: costBasis } as RealEstateMetadata }),
  } as Account
}

function investmentAccount(id: number, type: 'PEA' | 'PER' | 'PRECIOUS_METALS' | 'OTHER', balanceEur: number): Account {
  return {
    id,
    name: `Compte ${id}`,
    type,
    provider: 'Example',
    currency: 'EUR',
    currentBalance: balanceEur,
    currentBalanceEur: balanceEur,
    lastSyncedAt: null,
    isManual: true,
    color: '#6366f1',
    ticker: null,
    logoUrl: null,
    logoKey: null,
    createdAt: '2026-01-01T00:00:00Z',
  } as Account
}

/** One history point per account: a property reports invested = its own balance. */
function history(accounts: Account[]): NetWorthPoint[] {
  const entries = Object.fromEntries(
    accounts.map(a => [String(a.id), { total: a.currentBalanceEur, invested: a.currentBalanceEur, pnl: 0 }])
  )
  return [{ date: '2026-08-01', total: 0, invested: 0, pnl: 0, accounts: entries }]
}

/** Click the Immobilier filter chip. */
function selectRealEstate() {
  fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.REAL_ESTATE' }))
}

describe('AccountsPage - Immobilier gain / loss', () => {
  beforeEach(() => {
    useAccounts.mockReset()
    useHistory.mockReset()
    usePeerLoansOverview.mockReturnValue({ data: undefined })
  })

  it('shows the gain against the property cost basis, not the snapshot invested amount', () => {
    const accounts = [property(1, 300000, 250000)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })

    renderPage()
    selectRealEstate()

    // 300 000 - 250 000 = +50 000, i.e. +20.0 %
    expect(screen.getByText('dashboard.portfolioPerformance')).toBeInTheDocument()
    expect(screen.getByText('(+20.0%)')).toBeInTheDocument()
  })

  it('renders the PnL chart for the Immobilier filter', () => {
    const accounts = [property(1, 300000, 250000)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })

    renderPage()
    selectRealEstate()

    expect(screen.getByTestId('pnl-chart')).toBeInTheDocument()
  })

  it('stays silent for a property described but never given a purchase price', () => {
    // Its balance must not read as pure gain.
    const accounts = [property(1, 300000)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })

    renderPage()
    selectRealEstate()

    expect(screen.queryByText('dashboard.portfolioPerformance')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pnl-chart')).not.toBeInTheDocument()
  })

  it('does not let a basis-less property inflate the gain of the one beside it', () => {
    const accounts = [property(1, 300000, 250000), property(2, 200000)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })

    renderPage()
    selectRealEstate()

    // Gain stays +50 000 over a 450 000 basis (250 000 + the second property's own value),
    // not +50 000 over 250 000 and certainly not +250 000.
    expect(screen.getByText('(+11.1%)')).toBeInTheDocument()
  })

  it('does not publish a partial group PnL when an investment account has unknown basis', () => {
    const accounts = [investmentAccount(1, 'PEA', 12000), investmentAccount(2, 'PER', 9987)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({
      data: [{
        date: '2026-08-01',
        total: 21987,
        invested: null,
        pnl: null,
        accounts: {
          '1': { total: 12000, invested: 10000, pnl: 2000 },
          '2': { total: 9987, invested: null, pnl: null },
        },
      }],
      isLoading: false,
    })

    renderPage()

    expect(screen.queryByText('dashboard.portfolioPerformance')).not.toBeInTheDocument()
    const chartData = JSON.parse(screen.getByTestId('pnl-chart').getAttribute('data-chart') ?? '[]') as Array<Record<string, string | number>>
    expect(chartData[0]).not.toHaveProperty('STOCKS')
  })

  it('leaves a missing historical account observation out of its PnL chart', () => {
    const accounts = [investmentAccount(1, 'PEA', 10000)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({
      data: [{
        date: '2026-08-01',
        total: 0,
        invested: null,
        pnl: null,
        accounts: {},
      }],
      isLoading: false,
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.STOCKS' }))

    const chartData = JSON.parse(screen.getByTestId('pnl-chart').getAttribute('data-chart') ?? '[]') as Array<Record<string, string | number>>
    expect(chartData[0]).not.toHaveProperty('1')
  })
})

describe('AccountsPage - card actions on touch screens', () => {
  beforeEach(() => {
    useAccounts.mockReset()
    useHistory.mockReset()
    usePeerLoansOverview.mockReturnValue({ data: undefined })
  })

  it('keeps the edit and delete buttons visible without hover', () => {
    // A touch screen has no hover: the buttons must not depend on it alone.
    const accounts = [investmentAccount(1, 'PEA', 1000)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })

    renderPage()

    for (const name of ['common.edit', 'common.delete']) {
      const actions = screen.getByRole('button', { name }).parentElement
      expect(actions).toHaveClass('pointer-coarse:opacity-100', 'group-focus-within:opacity-100')
    }
  })
})

describe('AccountsPage - closed peer loans', () => {
  beforeEach(() => {
    useAccounts.mockReset()
    useHistory.mockReset()
    usePeerLoansOverview.mockReturnValue({ data: undefined })
  })

  it('hides a closed loan by default and reveals it with the Receivables toggle', () => {
    const closedLoan: Account = {
      id: 99,
      name: 'Camille',
      type: 'PEER_LOAN',
      provider: null,
      currency: 'EUR',
      currentBalance: 0,
      currentBalanceEur: 0,
      lastSyncedAt: null,
      isManual: true,
      color: '#0d9488',
      ticker: null,
      logoUrl: null,
      logoKey: null,
      createdAt: '2026-01-01T00:00:00Z',
      hidden: false,
      listPosition: null,
      listCollapsed: false,
    }
    useAccounts.mockReturnValue({ data: [closedLoan], isLoading: false })
    useHistory.mockReturnValue({ data: history([closedLoan]), isLoading: false })
    usePeerLoansOverview.mockReturnValue({
      data: {
        totalOutstanding: 0,
        openCount: 0,
        closedCount: 1,
        interestAccrued: 0,
        loans: [{
          accountId: 99,
          name: 'Camille',
          principal: 300,
          principalRemaining: 0,
          repaidPct: 100,
          interestAccrued: 0,
          interestReceived: 0,
          closedAt: '2026-11-05',
        }],
        history: [],
      },
    })

    renderPage()

    // Not an active card, and the Créances overview is not on screen yet.
    expect(screen.queryByText('Camille')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.RECEIVABLES' }))
    // The overview table lists it even before the toggle: only the cards are filtered.
    expect(screen.getAllByText('Camille')).toHaveLength(1)
    expect(screen.getAllByText('peerLoan.overview.status.closed')).toHaveLength(1)
    expect(screen.queryByText('peerLoan.summary.closed')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'accounts.showClosedLoans' }))
    // The closed loan now appears both in the overview table and on its account card.
    expect(screen.getAllByText('Camille')).toHaveLength(2)
    expect(screen.getAllByText('peerLoan.overview.status.closed')).toHaveLength(1)
    expect(screen.getAllByText('peerLoan.summary.closed')).toHaveLength(1)
  })
})

describe('AccountsPage — Métaux and Autre filters', () => {
  beforeEach(() => {
    useAccounts.mockReset()
    useHistory.mockReset()
    const accounts = [investmentAccount(1, 'PRECIOUS_METALS', 5000), investmentAccount(2, 'OTHER', 700)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })
  })

  it('lists a PRECIOUS_METALS account under Métaux and no longer an OTHER one', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.METALS' }))

    expect(screen.getByText('Compte 1')).toBeInTheDocument()
    expect(screen.queryByText('Compte 2')).not.toBeInTheDocument()
  })

  it('keeps an OTHER account reachable under its own filter', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.OTHER' }))

    expect(screen.getByText('Compte 2')).toBeInTheDocument()
    expect(screen.queryByText('Compte 1')).not.toBeInTheDocument()
  })
})

describe('AccountsPage — grouping, panel and edit deep link', () => {
  beforeEach(() => {
    useAccounts.mockReset()
    useHistory.mockReset()
  })

  function setup(accounts: Account[]) {
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })
  }

  it('switches the list from asset classes to institutions', () => {
    setup([investmentAccount(1, 'PEA', 1000), property(2, 300000)])
    renderPage()
    // The group headers name their section; the breakdown's legend repeats the class names.
    expect(screen.getByRole('region', { name: 'assetClasses.equity' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'accounts.groupBy.institution' }))
    expect(screen.getByRole('region', { name: 'Example' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'accounts.groupBy.property' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'assetClasses.equity' })).not.toBeInTheDocument()
  })

  it('opens the side panel when a row is clicked', () => {
    setup([investmentAccount(1, 'PEA', 1000)])
    renderPage()
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Compte 1/ }))
    expect(screen.getByTestId('panel')).toHaveTextContent('Compte 1')
  })

  it('opens the edit form from ?edit=<id> and drops the parameter on close', () => {
    setup([investmentAccount(1, 'PEA', 1000), investmentAccount(2, 'PER', 500)])
    renderPage('/accounts?edit=2')
    expect(screen.getByTestId('edit-form')).toHaveTextContent('Compte 2')

    fireEvent.click(screen.getByText('close-form'))
    expect(screen.queryByTestId('edit-form')).not.toBeInTheDocument()
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/)
  })

  it('ignores an unknown id', () => {
    setup([investmentAccount(1, 'PEA', 1000)])
    renderPage('/accounts?edit=99')
    expect(screen.queryByTestId('edit-form')).not.toBeInTheDocument()
  })
})

describe('AccountsPage - savings suggestion banner', () => {
  it('opens the savings configuration tab directly', () => {
    navigateMock.mockReset()
    useSavingsSuggestions.mockReturnValue({
      data: [{ accountId: 99, accountName: 'Livret A', suggestedProduct: 'LIVRET_A', defaultAnnualRate: 2.4 }],
    })
    const accounts = [investmentAccount(99, 'PEA', 100)]
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'savings.configureSavings' }))
    expect(navigateMock).toHaveBeenCalledWith('/accounts/99?tab=config')
    useSavingsSuggestions.mockReturnValue({ data: undefined })
  })
})

describe('AccountsPage - Tout list order and collapse', () => {
  beforeEach(() => {
    useAccounts.mockReset()
    useHistory.mockReset()
    orderMutate.mockReset()
    collapseMutate.mockReset()
    usePeerLoansOverview.mockReturnValue({ data: undefined })
  })

  function account(id: number, type: Account['type'], balance: number, extra: Partial<Account> = {}): Account {
    return {
      ...investmentAccount(id, 'PEA', balance),
      type,
      listPosition: null,
      listCollapsed: false,
      ...extra,
    }
  }

  function setup(accounts: Account[]) {
    useAccounts.mockReturnValue({ data: accounts, isLoading: false })
    useHistory.mockReturnValue({ data: history(accounts), isLoading: false })
  }

  /** Row names in screen order. */
  function rowNames(region: HTMLElement) {
    return within(region).getAllByText(/^Compte \d+$/).map((el) => el.textContent)
  }

  it('shows arrange controls on shared rows and sends every visible id', () => {
    setup([account(1, 'CHECKING', 100, { isOwner: true }), account(2, 'CHECKING', 100, { isOwner: false })])
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'accounts.reorder' }))

    // Both rows can be arranged: prefs are per viewer, owned or shared.
    expect(screen.getAllByRole('button', { name: 'accounts.moveUp' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'accounts.moveDown' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'accounts.collapseAccount' })).toHaveLength(2)

    // Moving the owned row down keeps the shared one in the saved order.
    fireEvent.click(screen.getAllByRole('button', { name: 'accounts.moveDown' })[0])
    expect(orderMutate).toHaveBeenCalledWith([2, 1])
    expect(collapseMutate).not.toHaveBeenCalled()
    // A control is not the row: the side panel stays closed.
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument()
  })

  it('keeps one filled primary button while reordering', () => {
    setup([account(1, 'CHECKING', 100)])
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'accounts.reorder' }))

    expect(screen.getByRole('button', { name: 'accounts.doneReordering' })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelectorAll('[data-slot="button"][data-variant="default"]')).toHaveLength(1)
  })

  it('orders each group by the saved positions, the rest largest first', () => {
    setup([
      account(1, 'CHECKING', 300),
      account(2, 'CHECKING', 200, { listPosition: 1 }),
      account(3, 'CHECKING', 100, { listPosition: 0 }),
      account(4, 'CHECKING', 400),
    ])
    renderPage()
    expect(rowNames(screen.getByRole('region', { name: 'assetClasses.cash' }))).toEqual(['Compte 3', 'Compte 2', 'Compte 4', 'Compte 1'])

    // Another tab keeps the natural order.
    fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.CHECKING' }))
    expect(rowNames(screen.getByRole('region', { name: 'assetClasses.cash' }))).toEqual(['Compte 4', 'Compte 1', 'Compte 2', 'Compte 3'])
    expect(screen.queryByRole('button', { name: 'accounts.reorder' })).not.toBeInTheDocument()
  })

  it('moves a row inside its group without moving any other row of the list', () => {
    // Cash: 1 then 3; stocks: 2. One order serves both groupings, so 2 keeps its place against 3.
    setup([account(1, 'CHECKING', 300), account(2, 'PEA', 200), account(3, 'CHECKING', 100)])
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'accounts.reorder' }))

    const cash = screen.getByRole('region', { name: 'assetClasses.cash' })
    expect(within(cash).getAllByRole('button', { name: 'accounts.moveUp' })[0]).toBeDisabled()
    fireEvent.click(within(cash).getAllByRole('button', { name: 'accounts.moveDown' })[0])
    expect(orderMutate).toHaveBeenCalledWith([2, 3, 1])

    const stocks = screen.getByRole('region', { name: 'assetClasses.equity' })
    expect(within(stocks).getByRole('button', { name: 'accounts.moveUp' })).toBeDisabled()
    expect(within(stocks).getByRole('button', { name: 'accounts.moveDown' })).toBeDisabled()
  })

  it('gathers collapsed accounts in a recap row that still counts them in the total', () => {
    setup([
      account(1, 'CHECKING', 100),
      account(2, 'CHECKING', 50, { listCollapsed: true }),
      account(3, 'LOAN', 30, { listCollapsed: true }),
    ])
    renderPage()

    expect(screen.getByText('Compte 1')).toBeInTheDocument()
    expect(screen.queryByText('Compte 2')).not.toBeInTheDocument()
    expect(screen.queryByText('Compte 3')).not.toBeInTheDocument()
    // The debts group had only the collapsed loan: it leaves the list with it.
    expect(screen.queryByRole('region', { name: 'accounts.filters.DEBTS' })).not.toBeInTheDocument()

    // Signed like the header total: 50 - 30.
    const recap = screen.getByText('accounts.collapsedRecap').closest('div')!
    expect(recap).toHaveTextContent(/20,00/)
    // 100 + 50 - 30: collapsing is display-only.
    expect(screen.getByText('accounts.total').closest('[data-slot="card"]')).toHaveTextContent(/120,00/)

    // Manage opens the reorder mode, where collapsed rows come back to be unfolded.
    fireEvent.click(screen.getByRole('button', { name: 'accounts.manageCollapsed' }))
    expect(screen.getByText('Compte 2')).toBeInTheDocument()
    expect(screen.queryByText('accounts.collapsedRecap')).not.toBeInTheDocument()
    const expand = screen.getAllByRole('button', { name: 'accounts.expandAccount' })
    expect(expand).toHaveLength(2)
    fireEvent.click(expand[0])
    expect(collapseMutate).toHaveBeenCalledWith({ id: 2, collapsed: false })

    // Another tab ignores the collapse.
    fireEvent.click(screen.getByRole('button', { name: 'accounts.filters.CHECKING' }))
    expect(screen.getByText('Compte 2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'accounts.expandAccount' })).not.toBeInTheDocument()
  })
})
