import { Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  className?: string
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * A calm "nothing here yet": a small icon on a muted disc, a card-sized title, one line of help.
 * Callers pass icons at any size; the disc draws them at 20px so no empty state shouts.
 */
export function EmptyState({ icon, title, description, className, action }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5" aria-hidden="true">
        {icon || <Package />}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-balance text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  )
}
