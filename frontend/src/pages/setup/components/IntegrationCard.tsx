import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  /** The integration's logo or monogram (`IntegrationMark`). */
  mark: ReactNode
  title: string
  description: string
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}

/**
 * One row of the integration picker. The whole row is the hit target (not just the
 * checkbox) so fat fingers on mobile work; it is still a semantic {@code button} with
 * {@code role="switch"} for keyboard and screen-reader users. Rows sit in a divided list.
 */
export function IntegrationCard({
  mark,
  title,
  description,
  checked,
  onToggle,
  disabled = false,
}: IntegrationCardProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-3 text-left transition-[background-color]',
        checked ? 'bg-primary/12' : 'hover:bg-muted/60',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {mark}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-5 text-muted-foreground">{description}</span>
      </span>
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
        )}
        aria-hidden="true"
      >
        {checked && <Check className="size-3.5 stroke-[3]" />}
      </span>
    </button>
  )
}
