import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { FinancialIndependenceCard, FinancialIndependenceSimulator } from './FinancialIndependence'
import { fiTarget, yearsToTarget, type FiBaseline } from './fi-math'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' ? `${key}:${Object.values(opts).join(',')}` : key,
    i18n: { resolvedLanguage: 'fr', language: 'fr' },
  }),
}))

const baseline: FiBaseline = {
  start: 50000,
  pace: 750,
  expenses: 2250,
  expensesStated: true,
  age: 34,
  retirementAge: 62,
}
const target = fiTarget(2250, 4)

function renderBoth(b: FiBaseline) {
  return render(
    <MemoryRouter>
      <FinancialIndependenceCard baseline={b} />
      <FinancialIndependenceSimulator baseline={b} />
    </MemoryRouter>,
  )
}

describe('FinancialIndependence', () => {
  it('shows the age of independence at the current pace', () => {
    renderBoth(baseline)
    const years = yearsToTarget(50000, 750, 5, target)!

    expect(screen.getAllByText(`analysis.projection.atAge:${34 + years}`).length).toBeGreaterThan(0)
    expect(screen.queryByText('analysis.fi.fillProfile')).not.toBeInTheDocument()
  })

  it('shows a duration and asks for the birth date when it is missing', () => {
    renderBoth({ ...baseline, age: null })
    const years = yearsToTarget(50000, 750, 5, target)!

    expect(screen.getAllByText(`analysis.fi.inYears:${years}`).length).toBeGreaterThan(0)
    expect(screen.getByText('analysis.fi.fillProfile')).toBeInTheDocument()
    expect(screen.queryByText(/analysis\.fi\.sim\.capitalAt/)).not.toBeInTheDocument()
  })

  it('compares a higher savings rate with the current pace, then resets', () => {
    renderBoth(baseline)
    const reset = screen.getByRole('button', { name: 'analysis.fi.sim.reset' })
    expect(reset).toBeDisabled()

    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '2000' } })
    const gained = yearsToTarget(50000, 750, 5, target)! - yearsToTarget(50000, 2000, 5, target)!
    expect(screen.getByText(`analysis.fi.sim.earlier:${gained}`)).toBeInTheDocument()

    fireEvent.click(reset)
    expect(screen.getByText('analysis.fi.sim.same')).toBeInTheDocument()
  })
})
