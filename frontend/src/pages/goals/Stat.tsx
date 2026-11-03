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
