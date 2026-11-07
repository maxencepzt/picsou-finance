import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
vi.stubGlobal('sessionStorage', memoryStorage())

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('@/features/auth/api', () => ({ authApi: { refresh } }))

vi.mock('@/components/layout/AppLayout', () => ({
  AppLayout: () => (
    <main data-testid="app-shell">
      <Outlet />
    </main>
  ),
}))

const { router } = await import('./routes')
const { useAuthStore } = await import('@/stores/auth-store')
const { useAppStore } = await import('@/stores/app-store')

const USER = { username: 'alice', role: 'ADMIN' as const, memberId: 1, displayName: 'Alice' }

async function renderAt(path: string) {
  await act(() => router.navigate(path))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('error routes', () => {
  beforeEach(() => {
    refresh.mockReset()
    refresh.mockRejectedValue(new Error('401'))
    useAppStore.setState({ demoMode: false })
    useAuthStore.getState().logout()
  })
  afterEach(cleanup)

  it.each([
    // Each error screen titles itself; its code sits in the caption above.
    ['/does-not-exist', 'error.notFoundTitle'],
    ['/error/403', 'error.forbiddenTitle'],
    ['/error/500', 'error.serverErrorTitle'],
  ])('renders %s inside the app shell for a signed-in user', async (path, title) => {
    useAuthStore.setState({ user: USER, isAuthenticated: true })

    await renderAt(path)

    const heading = await screen.findByRole('heading', { name: title })
    expect(within(screen.getByTestId('app-shell')).getByRole('heading', { name: title })).toBe(heading)
  })

  it('renders the 404 without the app shell for a signed-out visitor', async () => {
    await renderAt('/does-not-exist')

    expect(await screen.findByRole('heading', { name: 'error.notFoundTitle' })).toBeInTheDocument()
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('restores a Remember Me session and renders the 404 inside the app shell', async () => {
    refresh.mockResolvedValue(USER)

    await renderAt('/does-not-exist')

    const heading = await screen.findByRole('heading', { name: 'error.notFoundTitle' })
    expect(within(screen.getByTestId('app-shell')).getByRole('heading', { name: 'error.notFoundTitle' })).toBe(heading)
    expect(useAuthStore.getState().user).toEqual(USER)
  })

  it.each(['/does-not-exist', '/error/403', '/error/500'])(
    '%s offers back to the dashboard and back',
    async (path) => {
      await renderAt(path)

      expect(await screen.findByRole('link', { name: 'error.backToDashboard' })).toHaveAttribute('href', '/')
      expect(screen.getByRole('button', { name: 'common.back' })).toBeInTheDocument()
    },
  )
})
