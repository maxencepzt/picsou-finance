import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Account, GoalProgress } from '@/types/api'
import type { AllocationDraft } from './plan-math'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}))

const plan: GoalProgress = {
  id: 1,
  name: 'PEA plan',
  type: 'RECURRING_INVESTMENT',
  createdAt: '2026-01-01T00:00:00Z',
  historyStartMonth: null,
  accounts: [{ id: 2, name: 'PEA', color: '#1' } as Account],
  currentTotal: 1000,
  targetAmount: null,
  deadline: null,
  percentComplete: null,
  monthlyNeeded: null,
  avgMonthlyContribution: null,
  surplus: null,
  monthsLeft: 0,
  isOnTrack: true,
  monthlyAmount: 200,
  expectedReturn: null,
  startDate: null,
  endDate: null,
  allocations: [],
}

const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }
vi.mock('@/features/goals/hooks', () => ({
  useGoals: () => ({ data: [plan], isLoading: false, isError: false, refetch: vi.fn() }),
  useCreateGoal: () => mutation,
  useUpdateGoal: () => mutation,
  useDeleteGoal: () => mutation,
}))
vi.mock('@/features/accounts/hooks', () => ({ useAccounts: () => ({ data: [] }) }))
vi.mock('@/features/profile/hooks', () => ({ useMemberProfile: () => ({ data: undefined, isPending: false }) }))
vi.mock('./SavingsRateCard', () => ({ SavingsRateCard: () => null }))
vi.mock('./GoalDetailModal', () => ({ GoalDetailModal: () => null }))
vi.mock('./RecurringPlanStats', () => ({ RecurringPlanStats: () => null }))
// jsdom has no matchMedia; the date fields' touch check is not what this test is about.
vi.mock('@/hooks/use-touch-device', () => ({ useIsTouchDevice: () => false }))
// The picker's own rendering is covered by AllocationPicker.test; here it only hands lines back.
vi.mock('./AllocationPicker', () => ({
  AllocationPicker: ({ onChange }: { onChange: (next: AllocationDraft[]) => void }) => (
    <>
      <button type="button" onClick={() => onChange([{ ticker: 'CW8', amount: '' }])}>tick</button>
      <button type="button" onClick={() => onChange([{ ticker: 'CW8', amount: '100' }])}>fill</button>
    </>
  ),
}))

const { GoalsPage } = await import('./GoalsPage')

describe('GoalsPage plan form', () => {
  it('refuses to save a ticked holding with no amount instead of silently dropping it', () => {
    render(<MemoryRouter><GoalsPage /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }))
    const save = screen.getByRole('button', { name: 'common.save' })
    expect(save).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'tick' }))
    expect(save).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'fill' }))
    expect(save).toBeEnabled()
  })
})
