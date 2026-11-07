import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from '../navigation'
import { SetupCard } from '../../components/SetupCard'

interface EBSubstepShellProps {
  current: number
  total: number
  title: string
  description?: ReactNode
  children?: ReactNode
  /** Back / continue row of the card. */
  footer?: ReactNode
  /** Defaults to navigating to the next integration. Override to control "Skip" behavior. */
  onSkip?: () => void
}

/**
 * Unified chrome for every EB substep: a step card with a five-segment sub-progress,
 * the "Step X of 5 — Enable Banking" label and the "Skip this integration" escape hatch
 * that routes past EB without flipping any DB flag.
 */
export function EBSubstepShell({ current, total, title, description, children, footer, onSkip }: EBSubstepShellProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)

  const handleSkip = () => {
    if (onSkip) {
      onSkip()
      return
    }
    navigate(nextIntegrationRoute('enablebanking', selected))
  }

  return (
    <SetupCard
      headingLevel={2}
      top={
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full', i < current ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      }
      eyebrow={
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0">{t('setup.enablebanking.substep', { current, total })}</span>
          <Button type="button" variant="ghost" size="xs" onClick={handleSkip} className="-mr-3 shrink-0 px-3 text-[13px] text-muted-foreground">
            {t('setup.enablebanking.skip')}
          </Button>
        </span>
      }
      title={title}
      description={description}
      footer={footer}
    >
      {children}
    </SetupCard>
  )
}
