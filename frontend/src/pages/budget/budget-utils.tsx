import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { cn } from '@/lib/utils'
import type { CashflowPeriod } from '@/types/api'
import { FALLBACK_COLOR, type StatusTone } from './budget-meta'

/**
 * Shared presentational helpers for the Budget module. Static lookup tables live in
 * the component-free `budget-meta.ts` so this file exports only components (Fast Refresh).
 */

/** A small round colour swatch — used next to category names everywhere. */
export function ColorDot({ color, className }: { color?: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className ?? 'inline-block size-2.5 shrink-0 rounded-full'}
      style={{ backgroundColor: color || FALLBACK_COLOR }}
    />
  )
}

/** Cycle / YTD switch, shared by the cashflow, category and allocation views. */
export function PeriodToggle({
  value,
  onChange,
}: {
  value: CashflowPeriod
  onChange: (period: CashflowPeriod) => void
}) {
  const { t } = useTranslation()
  return (
    <SegmentedControl
      ariaLabel={t('budget.period.label')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'CYCLE', label: t('budget.period.cycle') },
        { value: 'YTD', label: t('budget.period.ytd') },
      ]}
    />
  )
}

const TONE: Record<StatusTone, { dot: string; text: string }> = {
  gain: { dot: 'bg-gain', text: 'text-gain' },
  warning: { dot: 'bg-warning', text: 'text-warning' },
  loss: { dot: 'bg-loss', text: 'text-loss' },
  muted: { dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

/** A status word with its dot: never a filled badge, so blue stays for what can be clicked. */
export function StatusDot({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-medium', TONE[tone].text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', TONE[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * The row under the budget section switch: what the page is about (or the way back) on the left,
 * its controls on the right. Every sub-page uses it, so the period navigator and the actions sit
 * at the same place everywhere.
 */
export function BudgetToolbar({ lead, children }: { lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      {lead && <div className="min-w-0 text-sm text-pretty text-muted-foreground">{lead}</div>}
      {children && <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">{children}</div>}
    </div>
  )
}
