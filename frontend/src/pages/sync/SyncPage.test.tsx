import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

// The connection statuses never answer: these tests are about which view opens, not about rows.
vi.mock('@/lib/api-client', () => ({ api: { get: () => new Promise(() => {}) } }))

vi.mock('@/components/shared/PageHeader', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

vi.mock('./LouveTab', () => ({ LouveTab: () => <div>louve-panel</div> }))
vi.mock('./BankSyncTab', () => ({ BankSyncTab: () => <div>banks-panel</div> }))

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

const { SyncPage } = await import('./SyncPage')

function renderAt(entry: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/sync" element={<SyncPage />} />
          <Route path="/sync/louve/callback" element={<SyncPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SyncPage Louve Invest entry points', () => {
  it('opens the Louve Invest panel on its OAuth callback path', () => {
    renderAt('/sync/louve/callback?code=c&state=s&iss=i')
    expect(screen.getByText('louve-panel')).toBeInTheDocument()
    expect(screen.queryByText('banks-panel')).not.toBeInTheDocument()
  })

  it('opens the Louve Invest panel from ?tab=louve, as the sync-all reconnect link does', () => {
    renderAt('/sync?tab=louve')
    expect(screen.getByText('louve-panel')).toBeInTheDocument()
  })

  it('lists Louve Invest in the catalog and opens its view from the tile', () => {
    renderAt('/sync')
    expect(screen.queryByText('louve-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^sync\.louve\.title/ }))
    expect(screen.getByText('louve-panel')).toBeInTheDocument()
  })
})
