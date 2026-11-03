import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EBSubstepShell } from './EBSubstepShell'
import { useTestEnableBanking } from '@/features/setup/hooks'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from '../navigation'
import { formatApiError } from '@/lib/errors'
import { SetupNote } from '../../components/SetupCard'

interface Props {
  onBack: () => void
}

type TestState =
  | { phase: 'idle' | 'running' | 'ok' }
  | { phase: 'ko'; code: string }
  | { phase: 'ko'; error: unknown }

const KNOWN_CODES = new Set([
  'invalid_application_id',
  'invalid_key_id',
  'public_key_not_uploaded',
  'redirect_uri_mismatch',
  'network',
])

export function EBStep5Test({ onBack }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const test = useTestEnableBanking()
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const markDone = useSetupFlowStore((s) => s.markIntegrationDone)
  const updateEbDraft = useSetupFlowStore((s) => s.updateEbDraft)

  const [state, setState] = useState<TestState>({ phase: 'idle' })
  const { phase } = state

  const run = () => {
    setState({ phase: 'running' })
    test.mutate(undefined, {
      onSuccess: (result) => {
        if (result.ok) {
          setState({ phase: 'ok' })
          updateEbDraft({ tested: true })
          markDone('enablebanking')
        } else {
          setState({ phase: 'ko', code: result.code })
        }
      },
      onError: (err) => {
        setState({ phase: 'ko', error: err })
      },
    })
  }

  const proceed = () => navigate(nextIntegrationRoute('enablebanking', selected))

  const failureMessage = state.phase !== 'ko'
    ? null
    : 'error' in state
      ? formatApiError(state.error, t)
      : t(KNOWN_CODES.has(state.code)
        ? `setup.enablebanking.test.hints.${state.code}`
        : 'setup.enablebanking.test.hints.unknown')

  return (
    <EBSubstepShell
      current={5}
      total={5}
      title={t('setup.enablebanking.test.title')}
      description={t('setup.enablebanking.test.body')}
      footer={
        phase === 'ok' ? (
          <Button onClick={proceed} className="w-full sm:w-auto">
            {t('setup.enablebanking.continue')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="ghost" onClick={onBack} disabled={phase === 'running'} className="w-full sm:mr-auto sm:w-auto">
              {t('setup.enablebanking.back')}
            </Button>
            <Button type="button" onClick={run} disabled={phase === 'running'} className="w-full sm:w-auto">
              {phase === 'running' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Zap aria-hidden="true" />}
              {phase === 'ko' ? t('setup.enablebanking.test.retry') : t('setup.enablebanking.test.run')}
            </Button>
          </>
        )
      }
    >
      {phase === 'idle' && (
        <SetupNote tone="warning" role="note">{t('setup.enablebanking.test.activationNotice')}</SetupNote>
      )}

      {phase === 'running' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('setup.enablebanking.test.running')}
        </p>
      )}

      {phase === 'ok' && (
        <SetupNote tone="success" role="status" title={t('setup.enablebanking.test.success')}>
          {t('setup.enablebanking.test.successBody')}
        </SetupNote>
      )}

      {phase === 'ko' && (
        <SetupNote tone="error" role="alert">{failureMessage}</SetupNote>
      )}
    </EBSubstepShell>
  )
}
