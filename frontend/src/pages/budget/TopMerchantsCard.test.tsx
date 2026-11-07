import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MerchantSpending } from '@/types/api'

const query = vi.hoisted(() => ({ current: { data: undefined, isLoading: false, isError: false, refetch: () => {} } as {
  data: MerchantSpending | undefined; isLoading: boolean; isError: boolean; refetch: () => void
} }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'fr', language: 'fr' } }),
}))
vi.mock('@/components/shared/CurrencyDisplay', () => ({
  CurrencyDisplay: ({ value }: { value: number }) => <span>{value.toFixed(2)}</span>,
}))
vi.mock('@/features/budget/hooks', () => ({ useSpendingByMerchant: () => query.current }))

const { TopMerchantsCard } = await import('./TopMerchantsCard')

describe('TopMerchantsCard', () => {
  it('lists the merchants and sums what they leave out of the total on one line', () => {
    query.current = {
      ...query.current,
      data: {
        from: '2026-10-25', to: '2026-11-24', total: 1000,
        merchants: [
          { key: 'brand:1', label: 'Carrefour', logoUrl: null, amount: 400, count: 7, share: 40 },
          { key: 'label:sncf', label: 'SNCF', logoUrl: null, amount: 250, count: 2, share: 25 },
        ],
      },
    }
    render(<TopMerchantsCard />)
    expect(screen.getByText('Carrefour')).toBeInTheDocument()
    expect(screen.getByText('budget.overview.merchants.others')).toBeInTheDocument()
    // 1000 − 400 − 250
    expect(screen.getByText('350.00')).toBeInTheDocument()
  })

  it('has no "others" line when the merchants cover the whole spend', () => {
    query.current = {
      ...query.current,
      data: { from: '', to: '', total: 400, merchants: [{ key: 'brand:1', label: 'Carrefour', logoUrl: null, amount: 400, count: 7, share: 100 }] },
    }
    render(<TopMerchantsCard />)
    expect(screen.queryByText('budget.overview.merchants.others')).not.toBeInTheDocument()
  })

  it('says so when the cycle has no spend', () => {
    query.current = { ...query.current, data: { from: '', to: '', total: 0, merchants: [] } }
    render(<TopMerchantsCard />)
    expect(screen.getByText('budget.overview.merchants.empty')).toBeInTheDocument()
  })
})
