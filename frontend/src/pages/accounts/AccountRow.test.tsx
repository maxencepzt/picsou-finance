import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { StubImage } from '@/test/stubImage'
import type { Account, RealEstateMetadata } from '@/types/api'
import { AccountRow } from './AccountRow'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { label?: string }) => (key === 'common.labelColon' ? `${opts?.label}:` : key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}))

// The institution logo is opt-in through the budget settings, a query this suite has no client for.
let logoFetchEnabled = true
vi.mock('@/features/budget/hooks', () => ({
  useBudgetSettings: () => ({ data: { logoFetchEnabled } }),
}))

beforeEach(() => {
  logoFetchEnabled = true
  vi.stubGlobal('Image', StubImage)
})
afterEach(() => vi.unstubAllGlobals())

const HOUR = 60 * 60 * 1000
const NOW = Date.now()

const baseAccount: Account = {
  id: 1, name: 'Compte Courant BNP', type: 'CHECKING', provider: 'BNP Paribas', currency: 'EUR',
  currentBalance: 1000, currentBalanceEur: 1000, lastSyncedAt: null, isManual: false, color: '#6366f1',
  ticker: null, logoUrl: null, logoKey: null, createdAt: '2024-01-01T00:00:00Z', hidden: false,
}

function property(metadata: Partial<RealEstateMetadata> = {}): Account {
  return {
    ...baseAccount, id: 8, name: 'Résidence principale', type: 'REAL_ESTATE', provider: null, isManual: true,
    currentBalance: 412000, currentBalanceEur: 412000,
    realEstate: { propertyKind: 'HOUSE', city: 'Bordeaux', lastValuedAt: '2026-01-10', ...metadata } as RealEstateMetadata,
  }
}

function renderRow(account: Account) {
  return render(
    <ul>
      <AccountRow account={account} now={NOW} onOpen={() => {}} onEdit={() => {}} onDelete={() => {}} />
    </ul>,
  )
}

describe('AccountRow mark', () => {
  it('shows the monogram when the account has no logo', () => {
    const { container, getByText } = renderRow(baseAccount)
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(getByText('CC')).toBeInTheDocument()
  })

  it.each([
    ['the connector logo', { logoUrl: 'https://logos.example/bnp.png' }, 'https://logos.example/bnp.png'],
    ['a bundled provider logo', { provider: 'MERIA' }, '/exchanges/meria.svg'],
    ['the connector logo over a bundled one', { provider: 'MERIA', logoUrl: 'https://logos.example/bnp.png' }, 'https://logos.example/bnp.png'],
    ["the account's own key over everything", { provider: 'MERIA', logoUrl: 'https://logos.example/bnp.png', logoKey: 'ledger' }, '/wallets/ledger.svg'],
    ['the provider logo when the key has no asset', { provider: 'MERIA', logoKey: 'trezor' }, '/exchanges/meria.svg'],
  ] as const)('uses %s', async (_label, overrides, src) => {
    const { container } = renderRow({ ...baseAccount, ...overrides })
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', src))
  })

  it('falls back to the monogram when the logo fails to load', async () => {
    const { container, getByText } = renderRow({ ...baseAccount, logoUrl: 'https://logos.example/broken.png' })
    // The stub settles on a microtask; the fallback also shows while loading, so let it settle first.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.querySelector('img')).not.toBeInTheDocument()
    expect(getByText('CC')).toBeInTheDocument()
  })

  it.each([
    ['HOUSE', 'lucide-house'],
    ['APARTMENT', 'lucide-building-2'],
    ['PARKING', 'lucide-square-parking'],
  ] as const)('marks a %s with its kind glyph', (propertyKind, iconClass) => {
    const { container } = renderRow(property({ propertyKind }))
    expect(container.querySelector(`.${iconClass}`)).toBeInTheDocument()
  })
})

describe('AccountRow subtitle and freshness', () => {
  it('stands the kind and city in for the provider of a property', () => {
    const { getByText } = renderRow(property())
    expect(getByText(/property\.kind\.HOUSE · Bordeaux/)).toBeInTheDocument()
  })

  it('warns about a synced account not refreshed for days', () => {
    const { getByText } = renderRow({ ...baseAccount, lastSyncedAt: new Date(NOW - 72 * HOUR).toISOString() })
    expect(getByText('accounts.syncStale')).toBeInTheDocument()
  })

  it('does not warn about a recent sync', () => {
    const { queryByText } = renderRow({ ...baseAccount, lastSyncedAt: new Date(NOW - HOUR).toISOString() })
    expect(queryByText('accounts.syncStale')).not.toBeInTheDocument()
  })

  it('never warns about a manual account, whose figure is typed by hand', () => {
    const { queryByText } = renderRow({ ...baseAccount, isManual: true, lastSyncedAt: new Date(NOW - 240 * HOUR).toISOString() })
    expect(queryByText('accounts.syncStale')).not.toBeInTheDocument()
  })
})

describe('AccountRow for an account an aggregator delivered', () => {
  const simplefin: Account = {
    ...baseAccount,
    id: 42,
    name: 'Fidelity Investments — Health Savings Account',
    provider: 'SimpleFIN',
    institution: { name: 'Fidelity Investments', hasLogo: true },
  }

  it('names the bank and says the bridge delivered it', () => {
    const { getByText } = renderRow(simplefin)
    expect(getByText('Fidelity Investments · accounts.viaProvider')).toBeInTheDocument()
  })

  it('asks for the bank logo through the account when logos are enabled', async () => {
    const { container } = renderRow(simplefin)
    await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', '/api/accounts/42/institution-logo'))
  })

  it('requests no logo while logos are disabled, falling back to the monogram', () => {
    logoFetchEnabled = false
    const { container } = renderRow(simplefin)
    expect(container.querySelector('img')).toBeNull()
  })

  it('requests no logo when the server has no domain for the bank', () => {
    const { container } = renderRow({ ...simplefin, institution: { name: 'Fidelity Investments', hasLogo: false } })
    expect(container.querySelector('img')).toBeNull()
  })

  it('keeps the bare provider as the subtitle for an account with no institution', () => {
    const { getByText } = renderRow({ ...simplefin, institution: null })
    expect(getByText('SimpleFIN')).toBeInTheDocument()
  })
})

describe('AccountRow for a closed peer loan', () => {
  it('marks it as closed', () => {
    const loan: Account = { ...baseAccount, id: 16, name: 'Camille', type: 'PEER_LOAN', provider: null, currentBalance: 0, currentBalanceEur: 0, isManual: true }
    const { getByText } = render(
      <ul>
        <AccountRow account={loan} now={NOW} closed onOpen={() => {}} onEdit={() => {}} />
      </ul>,
    )
    expect(getByText('peerLoan.summary.closed')).toBeInTheDocument()
  })
})
