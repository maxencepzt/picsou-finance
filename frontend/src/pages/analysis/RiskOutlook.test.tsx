import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RiskOutlook } from './RiskOutlook'
import { mockProjectionRisk } from '@/demo/data/analysis'

const useProjectionRisk = vi.fn()
vi.mock('@/features/analysis/hooks', () => ({
  useProjectionRisk: (years: number) => useProjectionRisk(years),
  useProjectionDateLabel: () => (date: string) => date,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' ? `${key}:${Object.values(opts).join(',')}` : key,
    i18n: { resolvedLanguage: 'fr', language: 'fr' },
  }),
}))

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children, ...props }: { children: React.ReactNode; 'aria-label'?: string }) => (
    <div data-slot="chart" aria-label={props['aria-label']}>{children}</div>
  ),
  ChartTooltip: () => null,
}))

describe('RiskOutlook', () => {
  beforeEach(() => {
    useProjectionRisk.mockReturnValue({ data: mockProjectionRisk(20) })
  })

  it('asks for the horizon the card is set to', () => {
    render(<RiskOutlook years={20} />)
    expect(useProjectionRisk).toHaveBeenCalledWith(20)
  })

  it('states the risk figures in words', () => {
    render(<RiskOutlook years={20} />)
    expect(screen.getByText(/analysis\.projection\.risk\.belowLabel/)).toBeInTheDocument()
    expect(screen.getByText(/analysis\.projection\.risk\.drawdownLabel/)).toBeInTheDocument()
    expect(screen.getByText(/analysis\.projection\.risk\.worstLabel/)).toBeInTheDocument()
    expect(screen.getByText(/analysis\.projection\.risk\.rangeLabel/)).toBeInTheDocument()
  })

  it('names only the tiers that actually swing', () => {
    render(<RiskOutlook years={20} />)
    const method = screen.getByText(/analysis\.projection\.risk\.method/)
    expect(method).toHaveTextContent('analysis.tiers.EQUITY')
    expect(method).toHaveTextContent('analysis.tiers.CRYPTO')
    expect(method).not.toHaveTextContent('analysis.tiers.SAFETY_NET')
  })

  it('holds the place of the chart while the simulation runs', () => {
    useProjectionRisk.mockReturnValue({ data: undefined, isLoading: true })
    const { container } = render(<RiskOutlook years={20} />)
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('offers a retry when the simulation fails', () => {
    const refetch = vi.fn()
    useProjectionRisk.mockReturnValue({ data: undefined, isError: true, refetch })
    render(<RiskOutlook years={20} />)
    screen.getByRole('button').click()
    expect(refetch).toHaveBeenCalled()
  })

  it('renders nothing until the simulation has answered', () => {
    useProjectionRisk.mockReturnValue({ data: undefined })
    const { container } = render(<RiskOutlook years={20} />)
    expect(container).toBeEmptyDOMElement()
  })
})
