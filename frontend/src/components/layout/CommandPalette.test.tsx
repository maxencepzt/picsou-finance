import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr', resolvedLanguage: 'fr', changeLanguage: () => {} },
  }),
}))
vi.mock('@/features/accounts/hooks', () => ({
  useAccounts: () => ({ data: [{ id: 7, name: 'Livret Épargne', type: 'SAVINGS', currentBalanceEur: 5120 }] }),
  usePortfolio: () => ({
    data: [{ id: '2-NVDA', name: 'NVIDIA Corp.', ticker: 'NVDA', accountId: 2, accountName: 'PEA', valueEur: 8800 }],
  }),
}))

const { CommandPalette } = await import('./CommandPalette')

function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>
}

function renderPalette(onSyncAll = vi.fn()) {
  const onOpenChange = vi.fn()
  render(
    <MemoryRouter initialEntries={['/']}>
      <CommandPalette open onOpenChange={onOpenChange} onSyncAll={onSyncAll} />
      <Path />
    </MemoryRouter>,
  )
  return { onOpenChange, onSyncAll, input: screen.getByRole('combobox') }
}

describe('CommandPalette', () => {
  it('offers actions and pages before anything is typed', () => {
    renderPalette()
    expect(screen.getByRole('option', { name: /palette.syncAll/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /nav.investments/ })).toBeInTheDocument()
  })

  it('finds holdings and accounts regardless of accents and case', () => {
    const { input } = renderPalette()
    fireEvent.change(input, { target: { value: 'epargne' } })
    expect(screen.getByRole('option', { name: /Livret Épargne/ })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /NVIDIA/ })).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'nvd' } })
    expect(screen.getByRole('option', { name: /NVIDIA/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the highlighted result with Enter and closes', () => {
    const { input, onOpenChange } = renderPalette()
    fireEvent.change(input, { target: { value: 'nvd' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('path')).toHaveTextContent('/accounts/2')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('moves the highlight with the arrow keys, wrapping around', () => {
    const { input, onSyncAll } = renderPalette()
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSyncAll).toHaveBeenCalled()
  })
})
