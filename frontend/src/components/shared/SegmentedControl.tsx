import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Icon-only segment: the label becomes its accessible name and tooltip. */
  icon?: LucideIcon
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  /** Stretch the segments to the full width (phones). */
  fill?: boolean
}

/**
 * The compact switch used in card headers: period (1M · 1A · Max), view (bar · donut · treemap).
 * A dense control by design — 32px inside a muted track — next to the 40px page-level controls.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, className, fill }: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('inline-flex gap-0.5 rounded-lg bg-muted p-0.5', fill && 'flex w-full', className)}>
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            aria-label={Icon ? option.label : undefined}
            title={Icon ? option.label : undefined}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-8 min-w-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap transition-[background-color,color]',
              fill && 'flex-1 basis-0',
              selected ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : option.label}
          </button>
        )
      })}
    </div>
  )
}
