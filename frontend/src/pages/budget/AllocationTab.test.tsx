import '@testing-library/jest-dom'
import { act, cleanup, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AMOUNT_MASK } from '@/lib/money'
import { useAppStore } from '@/stores/app-store'
import en from '@/i18n/locales/en.json'
import de from '@/i18n/locales/de.json'
import es from '@/i18n/locales/es.json'

const state = vi.hoisted(() => ({ totalStock: 12_500 }))

vi.mock('./PeriodNavigator', () => ({ PeriodNavigator: () => null }))
vi.mock('./BudgetPeriodContext', () => ({
  useBudgetPeriod: () => ({ anchor: undefined, setAnchor: vi.fn() }),
}))
vi.mock('@/features/budget/hooks', () => ({
  useAllocation: () => ({
    data: {
      totalStock: state.totalStock,
      stock: [{ assetClass: 'SAVINGS', amount: state.totalStock, percent: 100 }],
      totalContributions: 0,
      contributions: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

// Recharts does not lay out in jsdom; the donut's picture is irrelevant, its centre total is not.
vi.mock('@/components/shared/BreakdownChart', () => ({
  BreakdownDonut: () => null,
  BreakdownTreemap: () => null,
}))

const { AllocationTab } = await import('./AllocationTab')
const i18n = createInstance()
await i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: en }, de: { translation: de }, es: { translation: es } },
  interpolation: { escapeValue: false },
})

describe('AllocationTab total', () => {
  beforeEach(async () => {
    state.totalStock = 12_500
    useAppStore.getState().setHideAmounts(false)
    await i18n.changeLanguage('en')
  })
  afterEach(cleanup)

  function renderTab() {
    return render(<I18nextProvider i18n={i18n}><AllocationTab /></I18nextProvider>)
  }

  /** The total written in the donut's centre, under its label. */
  function centre() {
    return screen.getByText(i18n.t('budget.overview.investable')).nextElementSibling as HTMLElement
  }

  it('masks the donut centre when privacy mode is toggled and restores it when revealed', () => {
    renderTab()
    const total = centre()
    const visible = total.textContent
    expect(visible).toContain('12,500')
    expect(visible).toContain('€')

    act(() => { useAppStore.getState().setHideAmounts(true) })
    expect(total.textContent).toContain(AMOUNT_MASK)
    expect(total.textContent).not.toMatch(/\d/)

    act(() => { useAppStore.getState().setHideAmounts(false) })
    expect(total.textContent).toBe(visible)
  })

  it('also masks the total when mounted with privacy mode enabled', () => {
    useAppStore.getState().setHideAmounts(true)
    renderTab()
    expect(centre().textContent).toContain(AMOUNT_MASK)
    expect(centre().textContent).not.toMatch(/\d/)
  })

  it('shows the empty state, not a zero donut, when nothing is held', () => {
    state.totalStock = 0
    renderTab()
    expect(screen.getByText(en.budget.allocation.noStock)).toBeInTheDocument()
  })

  it('uses the app locale when the mounted view switches languages', async () => {
    renderTab()
    await act(async () => { await i18n.changeLanguage('de') })
    expect(centre()).toHaveTextContent('12.500')

    await act(async () => { await i18n.changeLanguage('es') })
    expect(centre()).toHaveTextContent('12.500')
  })
})
