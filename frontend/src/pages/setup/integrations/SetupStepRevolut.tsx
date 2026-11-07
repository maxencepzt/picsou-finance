import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAcknowledgeIntegration } from '@/features/setup/hooks'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from './navigation'
import { IntegrationMark } from '../components/IntegrationMark'
import { SetupCard, SetupNote } from '../components/SetupCard'

export function SetupStepRevolut() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ack = useAcknowledgeIntegration()
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const markDone = useSetupFlowStore((s) => s.markIntegrationDone)

  const proceed = async () => {
    try {
      await ack.mutateAsync('revolut')
      markDone('revolut')
    } catch {
      /* swallow — ack is best-effort; user can re-enable from Settings. */
    }
    navigate(nextIntegrationRoute('revolut', selected))
  }

  const skip = () => navigate(nextIntegrationRoute('revolut', selected))

  return (
    <SetupCard
      icon={<IntegrationMark integration="revolut" label={t('setup.integrations.cards.revolut.title')} className="size-10 rounded-xl after:rounded-xl" />}
      eyebrow={t('setup.steps.integrations')}
      title={t('setup.revolut.title')}
      description={t('setup.revolut.body')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={skip} disabled={ack.isPending} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.revolut.skip')}
          </Button>
          <Button onClick={proceed} disabled={ack.isPending} className="w-full sm:w-auto">
            {ack.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t('setup.revolut.cta')}
          </Button>
        </>
      }
    >
      <SetupNote>{t('setup.revolut.tip')}</SetupNote>
    </SetupCard>
  )
}
