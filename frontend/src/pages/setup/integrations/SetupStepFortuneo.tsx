import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAcknowledgeIntegration } from '@/features/setup/hooks'
import { formatApiError } from '@/lib/errors'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from './navigation'
import { IntegrationMark } from '../components/IntegrationMark'
import { SetupCard, SetupNote } from '../components/SetupCard'

export function SetupStepFortuneo() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ack = useAcknowledgeIntegration()
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const markDone = useSetupFlowStore((s) => s.markIntegrationDone)

  const proceed = async () => {
    try {
      await ack.mutateAsync('fortuneo')
      markDone('fortuneo')
      navigate(nextIntegrationRoute('fortuneo', selected))
    } catch {
      // Keep the step mounted so the mutation error is visible and retryable.
    }
  }

  const skip = () => navigate(nextIntegrationRoute('fortuneo', selected))

  return (
    <SetupCard
      icon={<IntegrationMark integration="fortuneo" label={t('setup.integrations.cards.fortuneo.title')} className="size-10 rounded-xl after:rounded-xl" />}
      eyebrow={t('setup.steps.integrations')}
      title={t('setup.fortuneo.title')}
      description={t('setup.fortuneo.body')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={skip} disabled={ack.isPending} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.fortuneo.skip')}
          </Button>
          <Button onClick={proceed} disabled={ack.isPending} className="w-full sm:w-auto">
            {ack.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t('setup.fortuneo.cta')}
          </Button>
        </>
      }
    >
      <SetupNote>{t('setup.fortuneo.tip')}</SetupNote>
      {ack.isError && (
        <SetupNote tone="error" role="alert">
          {formatApiError(ack.error, t)}
        </SetupNote>
      )}
    </SetupCard>
  )
}
