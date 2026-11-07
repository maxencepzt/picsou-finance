import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (key) => m.get(key) ?? null,
    setItem: (key, value) => void m.set(key, String(value)),
    removeItem: (key) => void m.delete(key),
    clear: () => m.clear(),
    key: (index) => [...m.keys()][index] ?? null,
    get length() { return m.size },
  } as Storage
}

vi.stubGlobal('localStorage', memoryStorage())

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr', resolvedLanguage: 'fr', changeLanguage: () => {} },
  }),
}))
vi.mock('@/features/accounts/hooks', () => ({ useAccounts: () => ({ data: [] }) }))
vi.mock('@/features/sync/hooks', () => ({ useBankSyncStatus: () => ({ data: [] }) }))

const { AppTopBar, PrivacyToggle } = await import('./AppTopBar')
const { useAppStore } = await import('@/stores/app-store')

function renderTopBar(path = '/', handlers = { onOpenSearch: vi.fn(), onSyncAll: vi.fn() }) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <AppTopBar {...handlers} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return handlers
}

describe('AppTopBar', () => {
  beforeEach(() => useAppStore.getState().setHideAmounts(false))

  it('opens the search palette from the search field and the sync modal from its button', () => {
    const handlers = renderTopBar()
    fireEvent.click(screen.getAllByRole('button', { name: /topbar.search/ })[0])
    expect(handlers.onOpenSearch).toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'dashboard.syncAccounts' })[0])
    expect(handlers.onSyncAll).toHaveBeenCalled()
  })

  it('marks "Household" as current on the family view and "Me" elsewhere', () => {
    renderTopBar('/family')
    expect(screen.getByRole('link', { name: 'topbar.scopeHousehold' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'topbar.scopeMe' })).not.toHaveAttribute('aria-current')
  })
})

describe('PrivacyToggle', () => {
  beforeEach(() => useAppStore.getState().setHideAmounts(false))

  it('hides and reveals every amount in the app, and says which action it offers', () => {
    render(<PrivacyToggle />)

    // The label names the action, not the state -- the icon already carries the state.
    const button = screen.getByRole('button', { name: 'nav.hideAmounts' })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(button)

    expect(useAppStore.getState().hideAmounts).toBe(true)
    const pressed = screen.getByRole('button', { name: 'nav.showAmounts' })
    expect(pressed).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(pressed)
    expect(useAppStore.getState().hideAmounts).toBe(false)
  })

  it('persists the choice, because a refresh mid-demo must not reveal anything', () => {
    render(<PrivacyToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'nav.hideAmounts' }))

    // Written deliberately: `partialize` in app-store is an allowlist, so leaving the field out
    // fails silently -- no type error, no runtime error, the setting simply does not survive a
    // reload. Nothing else in the suite would notice.
    const stored = JSON.parse(localStorage.getItem('picsou-app') ?? '{}')
    expect(stored.state.hideAmounts).toBe(true)
  })
})
