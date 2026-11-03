import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** A label over its value, inside a card's `<dl>`. */
export function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold tabular-nums break-words', className)}>{children}</dd>
    </div>
  )
}

const TONE = {
  gain: { dot: 'bg-gain', text: 'text-gain' },
  warning: { dot: 'bg-warning', text: 'text-warning' },
  muted: { dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
} as const

/** A status word with its dot, never a filled badge: blue stays for what can be clicked. */
export function StatusDot({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold whitespace-nowrap', TONE[tone].text)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', TONE[tone].dot)} aria-hidden="true" />
      {children}
    </span>
  )
}
