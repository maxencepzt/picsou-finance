import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface KpiTileProps {
  label: string
  value: ReactNode
  /** A Delta or a short caption. */
  footer?: ReactNode
  className?: string
}

/**
 * One indicator of a KPI row: a label, a figure in ink, and one line under it.
 * The figure is never cut: it shrinks with the tile (two tiles a row on a phone leave ~8rem)
 * and the label and footer wrap instead of ending in an ellipsis.
 */
export function KpiTile({ label, value, footer, className }: KpiTileProps) {
  return (
    <div className={cn('@container flex min-w-0 flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-foreground/10', className)}>
      <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
      <span className="text-base leading-tight font-semibold tracking-tight tabular-nums text-foreground break-words @[9.5rem]:text-lg @[11.5rem]:text-[22px]">
        {value}
      </span>
      {footer && <span className="min-w-0 text-xs text-muted-foreground">{footer}</span>}
    </div>
  )
}
