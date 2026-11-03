import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

const useMemberProfile = vi.hoisted(() => vi.fn())
vi.mock('@/features/profile/hooks', () => ({ useMemberProfile }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }),
}))
vi.mock('@/components/shared/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ value }: { value: number }) => <span data-testid="currency">{value}</span>,
}))

const { PeersCard } = await import('./PeersCard')

const renderCard = (grossWorth: number) => render(<MemoryRouter><PeersCard grossWorth={grossWorth} /></MemoryRouter>)

describe('PeersCard', () => {
  it('compares with the median of the member’s age bracket', () => {
    useMemberProfile.mockReturnValue({ data: { age: 35 }, isLoading: false, isError: false })
    renderCard(228_600)
    expect(screen.getByText('dashboard.peers.bracket.30to39')).toBeInTheDocument()
    // 228 600 / 146 200 = 1.56 → 1.6 ×, gap +82 400.
    expect(screen.getByText('1.6 ×')).toBeInTheDocument()
    expect(screen.getAllByTestId('currency').map((el) => el.textContent)).toEqual(['228600', '146200', '82400'])
    expect(screen.queryByRole('link', { name: 'dashboard.peers.fillProfile' })).toBeNull()
  })

  it('falls back to every household and invites to fill the profile without a birth date', () => {
    useMemberProfile.mockReturnValue({ data: {}, isLoading: false, isError: false })
    renderCard(102_550)
    expect(screen.getByText('dashboard.peers.bracket.all')).toBeInTheDocument()
    expect(screen.getByText('0.5 ×')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'dashboard.peers.fillProfile' })).toHaveAttribute('href', '/settings?section=profile')
    expect(screen.getByRole('link', { name: 'dashboard.peers.source' })).toHaveAttribute('href', 'https://www.insee.fr/fr/statistiques/8672665')
  })
})
