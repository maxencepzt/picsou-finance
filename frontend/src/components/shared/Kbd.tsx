import type { ReactNode } from 'react'

/** A keyboard key as printed on a keycap. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-[6px] bg-card px-1.5 font-sans text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
      {children}
    </kbd>
  )
}
