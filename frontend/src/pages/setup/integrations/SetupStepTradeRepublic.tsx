import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAcknowledgeIntegration } from '@/features/setup/hooks'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from './navigation'
import { IntegrationMark } from '../components/IntegrationMark'
import { SetupCard, SetupNote } from '../components/SetupCard'

export function SetupStepTradeRepublic() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ack = useAcknowledgeIntegration()
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const markDone = useSetupFlowStore((s) => s.markIntegrationDone)

  const proceed = async () => {
    try {
      await ack.mutateAsync('traderepublic')
      markDone('traderepublic')
    } catch {
      /* swallow — ack is best-effort; user can re-enable from Settings. */
    }
    navigate(nextIntegrationRoute('traderepublic', selected))
  }

  const skip = () => navigate(nextIntegrationRoute('traderepublic', selected))

  return (
    <SetupCard
      icon={<IntegrationMark integration="traderepublic" label={t('setup.integrations.cards.traderepublic.title')} className="size-10 rounded-xl after:rounded-xl" />}
      eyebrow={t('setup.steps.integrations')}
      title={t('setup.tr.title')}
      description={t('setup.tr.body')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={skip} disabled={ack.isPending} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.tr.skip')}
          </Button>
          <Button onClick={proceed} disabled={ack.isPending} className="w-full sm:w-auto">
            {ack.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {t('setup.tr.cta')}
          </Button>
        </>
      }
    >
      <SetupNote>{t('setup.tr.tip')}</SetupNote>
    </SetupCard>
  )
}
