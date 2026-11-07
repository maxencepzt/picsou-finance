import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  /** Heading; defaults to a localized "Error". */
  title?: string
  message?: string
  onRetry?: () => void
  /** Only the message and the retry button: no icon, no heading. */
  messageOnly?: boolean
}

export function ErrorState({ title, message, onRetry, messageOnly }: ErrorStateProps) {
  const { t } = useTranslation()
  return (
    // Same build as EmptyState (small icon on a disc, card-sized title) so a failure reads calm, not loud.
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {!messageOnly && (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive" aria-hidden="true">
          <AlertTriangle className="size-5" />
        </div>
      )}
      {!messageOnly && <h3 className="text-sm font-semibold text-foreground">{title ?? t('common.errorTitle')}</h3>}
      {message && (
        <p className={messageOnly ? 'max-w-md text-sm text-balance text-muted-foreground' : 'mt-1 max-w-md text-sm text-balance text-muted-foreground'}>{message}</p>
      )}
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}
