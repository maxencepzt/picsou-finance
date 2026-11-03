import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useBoursoBankHealth } from '@/features/setup/hooks'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from './navigation'
import { IntegrationMark } from '../components/IntegrationMark'
import { SetupCard, SetupNote } from '../components/SetupCard'

type Phase = 'checking' | 'ok' | 'ko'

/**
 * Auto-pings the sidecar on mount. The backend flips the enabled flag on
 * success, so we only need to mark the integration done in the local store
 * and route forward. On failure we stay on this screen so the user can
 * start the container and retry without losing wizard position.
 */
export function SetupStepBoursoBank() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const health = useBoursoBankHealth()
  // Pull out the referentially-stable mutate fn so the check callback can
  // depend on it directly — depending on `health.mutate` makes exhaustive-deps
  // ask for the whole (unstable) mutation object instead.
  const { mutate: probeHealth } = health
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const markDone = useSetupFlowStore((s) => s.markIntegrationDone)

  const [phase, setPhase] = useState<Phase>('checking')
  const [detail, setDetail] = useState<string | null>(null)

  // Fire the health probe. State only changes inside the async mutation
  // callbacks (allowed in effects) — not synchronously in the effect body.
  const check = useCallback(() => {
    probeHealth(undefined, {
      onSuccess: (result) => {
        if (result.ok) {
          setPhase('ok')
          markDone('boursobank')
        } else {
          setPhase('ko')
          setDetail(result.hint)
        }
      },
      onError: () => {
        setPhase('ko')
        setDetail(null)
      },
    })
  }, [probeHealth, markDone])

  // Retry button: reset the visible state, then re-probe.
  const run = () => {
    setPhase('checking')
    setDetail(null)
    check()
  }

  useEffect(() => {
    check()
  }, [check])

  const proceed = () => navigate(nextIntegrationRoute('boursobank', selected))

  return (
    <SetupCard
      icon={<IntegrationMark integration="boursobank" label={t('setup.integrations.cards.boursobank.title')} className="size-10 rounded-xl after:rounded-xl" />}
      eyebrow={t('setup.steps.integrations')}
      title={t('setup.bourso.title')}
      description={t('setup.bourso.body')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={proceed} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.bourso.skip')}
          </Button>
          {phase === 'ko' ? (
            <Button onClick={run} disabled={health.isPending} className="w-full sm:w-auto">
              <RotateCw aria-hidden="true" />
              {t('setup.bourso.retry')}
            </Button>
          ) : (
            <Button onClick={proceed} disabled={phase === 'checking'} className="w-full sm:w-auto">
              {t('setup.bourso.continue')}
            </Button>
          )}
        </>
      }
    >
      {phase === 'checking' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('setup.bourso.pinging')}
        </p>
      )}

      {phase === 'ok' && <SetupNote tone="success">{t('setup.bourso.ok')}</SetupNote>}

      {phase === 'ko' && (
        <SetupNote tone="error" role="alert" title={t('setup.bourso.downTitle')}>
          {detail ?? t('setup.bourso.downHint')}
        </SetupNote>
      )}
    </SetupCard>
  )
}
