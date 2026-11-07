import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GoalProgress, RecurringStats } from '@/types/api'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
    i18n: { resolvedLanguage: 'fr', language: 'fr' },
  }),
}))

const useRecurringStats = vi.fn()
vi.mock('@/features/goals/hooks', () => ({ useRecurringStats: () => useRecurringStats() }))

const { RecurringPlanStats } = await import('./RecurringPlanStats')

const plan = {
  id: 4,
  type: 'RECURRING_INVESTMENT',
  allocations: [{ ticker: 'CW8', name: null, monthlyAmount: 300 }],
} as GoalProgress

function stats(partial: Partial<RecurringStats> = {}): RecurringStats {
  return {
    from: '2025-12-01',
    to: '2026-11-03',
    investedEur: 2750,
    purchases: 22,
    monthsWithPurchase: 11,
    monthsElapsed: 12,
    currentValueEur: 3086.4,
    gainEur: 336.4,
    gainPercent: 12.23,
    ...partial,
  }
}

describe('RecurringPlanStats', () => {
  it('shows what was invested, the months kept and the gain', () => {
    useRecurringStats.mockReturnValue({ data: stats() })
    render(<RecurringPlanStats goal={plan} />)

    expect(screen.getByText('11 / 12')).toBeInTheDocument()
    expect(screen.getByText(/^2\s750,00/)).toBeInTheDocument()
    expect(screen.getByText(/^3\s086,40/)).toBeInTheDocument()
    expect(screen.getByText('(+12.2%)')).toBeInTheDocument()
    expect(screen.queryByText('goals.planStats.noPrice')).not.toBeInTheDocument()
  })

  it('says a price is missing instead of valuing part of the purchases', () => {
    useRecurringStats.mockReturnValue({ data: stats({ currentValueEur: null, gainEur: null, gainPercent: null }) })
    render(<RecurringPlanStats goal={plan} />)

    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByText('goals.planStats.noPrice')).toBeInTheDocument()
  })

  it('says nothing was bought rather than showing a zero value', () => {
    useRecurringStats.mockReturnValue({
      data: stats({ investedEur: 0, purchases: 0, monthsWithPurchase: 0, currentValueEur: 0, gainEur: null, gainPercent: null }),
    })
    render(<RecurringPlanStats goal={plan} />)

    expect(screen.getByText('0 / 12')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByText('goals.planStats.noPurchase')).toBeInTheDocument()
  })

  it('asks for the split when the plan names no position to match purchases on', () => {
    useRecurringStats.mockReturnValue({ data: stats() })
    render(<RecurringPlanStats goal={{ ...plan, allocations: [] }} />)

    expect(screen.getByText('goals.planStats.needsSplit')).toBeInTheDocument()
    expect(screen.queryByText('11 / 12')).not.toBeInTheDocument()
  })

  it('renders nothing for a plan whose window has not started', () => {
    useRecurringStats.mockReturnValue({ data: stats({ monthsElapsed: 0, purchases: 0, monthsWithPurchase: 0 }) })
    const { container } = render(<RecurringPlanStats goal={plan} />)
    expect(container).toBeEmptyDOMElement()
  })
})
