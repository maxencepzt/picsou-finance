import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { cn, formatPercent } from '@/lib/utils'

interface DeltaProps {
  /** Signed change in euros. Omit to show only the percentage. */
  amount?: number | null
  /** Signed change in points (8.3 = 8.3 %). */
  percent?: number | null
  /** For debts and expenses: a decrease is the good news. */
  invert?: boolean
  /** Trailing words, e.g. "this month". */
  children?: ReactNode
  className?: string
}

/**
 * A signed change with an arrow, so the direction never rests on colour alone. Gain and loss
 * colours come from the theme; a zero change is neutral.
 */
export function Delta({ amount, percent, invert = false, children, className }: DeltaProps) {
  const sign = Math.sign(amount ?? percent ?? 0)
  const good = invert ? sign < 0 : sign > 0
  const Arrow = sign > 0 ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[13px] font-semibold tabular-nums',
        sign === 0 ? 'text-muted-foreground' : good ? 'text-gain' : 'text-loss',
        className,
      )}
    >
      {sign !== 0 && <Arrow className="size-3 shrink-0" aria-hidden="true" />}
      {amount != null && <CurrencyDisplay value={amount} showSign />}
      {percent != null && (amount != null
        ? <span>({formatPercent(percent, { signed: true })})</span>
        : <span>{formatPercent(percent, { signed: true })}</span>)}
      {children && <span className="font-medium">{children}</span>}
    </span>
  )
}
