import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'fr', changeLanguage: () => {} },
  }),
}))

const { MobileBottomNav } = await import('./MobileBottomNav')

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileBottomNav />
    </MemoryRouter>,
  )
}

describe('MobileBottomNav', () => {
  it('shows five labelled entries, the last one opening the rest', () => {
    renderAt('/')
    const bar = screen.getAllByRole('navigation')[0]
    expect(within(bar).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/', '/accounts', '/investments', '/budget'])
    expect(within(bar).getByRole('button', { name: 'nav.more' })).toBeInTheDocument()
  })

  it('reaches the family view, settings and sync through "More"', () => {
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: 'nav.more' }))
    expect(screen.getByRole('link', { name: 'nav.family' })).toHaveAttribute('href', '/family')
    expect(screen.getByRole('link', { name: 'nav.settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByRole('link', { name: 'nav.sync' })).toHaveAttribute('href', '/sync')
  })

  it('marks "More" as current on a page it holds, and nothing in the bar', () => {
    renderAt('/family')
    expect(screen.getByRole('button', { name: 'nav.more' })).toHaveAttribute('aria-current', 'page')
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    expect(current).toEqual([])
  })
})
