import type { ReactNode } from 'react'

/** A label over a figure in ink: the cards' unit of reading. Use inside a `<dl>`. */
export function Figure({ label, strong = false, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums text-foreground ${strong ? 'text-xl font-semibold' : 'text-base font-medium'}`}>{children}</dd>
    </div>
  )
}
