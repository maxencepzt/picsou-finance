import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Bitcoin, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useGenerateCryptoKey } from '@/features/setup/hooks'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { nextIntegrationRoute } from './navigation'
import { SetupCard, SetupNote } from '../components/SetupCard'

type Phase = 'idle' | 'running' | 'existed' | 'created' | 'error'

/**
 * The happy path in Docker-land is "key already exists" — the entrypoint
 * wrote it before Spring even booted, so the backend responds with
 * `existed: true` and we immediately mark the integration done. The UI
 * still shows the idle-then-action flow because bare-metal installs land
 * in the `created: true` branch.
 */
export function SetupStepCrypto() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const gen = useGenerateCryptoKey()
  // Stable mutate fn for the check callback's deps — see the matching note in
  // SetupStepBoursoBank: depending on `gen.mutate` makes exhaustive-deps ask
  // for the whole unstable mutation object.
  const { mutate: generateKey } = gen
  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const markDone = useSetupFlowStore((s) => s.markIntegrationDone)

  // Start in 'running' so the mount probe doesn't need a synchronous
  // setState in its effect — the loader shows immediately either way.
  const [phase, setPhase] = useState<Phase>('running')
  const [keyPath, setKeyPath] = useState<string | null>(null)

  // Fire the idempotent key-generation endpoint. State only changes inside
  // the async mutation callbacks (allowed in effects).
  const check = useCallback(() => {
    generateKey(undefined, {
      onSuccess: (result) => {
        setKeyPath(result.path)
        setPhase(result.existed ? 'existed' : 'created')
        markDone('crypto')
      },
      onError: () => setPhase('error'),
    })
  }, [generateKey, markDone])

  // Retry button: reset the visible state, then re-run.
  const run = () => {
    setPhase('running')
    check()
  }

  /**
   * Auto-fire on mount: most self-hosters land here with the key already
   * created by the Docker entrypoint, so eagerly triggering the idempotent
   * endpoint gives them a single-click "Continue" experience. Bare-metal
   * users will still see the regular success state after ~100ms.
   */
  useEffect(() => {
    check()
  }, [check])

  const proceed = () => navigate(nextIntegrationRoute('crypto', selected))
  const skip = () => navigate(nextIntegrationRoute('crypto', selected))

  const successCopy =
    phase === 'existed'
      ? t('setup.crypto.existed')
      : phase === 'created'
        ? t('setup.crypto.created')
        : ''

  return (
    <SetupCard
      icon={<Bitcoin />}
      eyebrow={t('setup.steps.integrations')}
      title={t('setup.crypto.title')}
      description={t('setup.crypto.body')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={skip} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.crypto.skip')}
          </Button>
          {phase === 'error' ? (
            <Button onClick={run} disabled={gen.isPending} className="w-full sm:w-auto">
              {t('setup.crypto.generateCta')}
            </Button>
          ) : (
            <Button onClick={proceed} disabled={phase === 'running'} className="w-full sm:w-auto">
              {t('setup.crypto.continue')}
            </Button>
          )}
        </>
      }
    >
      {(phase === 'idle' || phase === 'running') && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t('setup.crypto.generating')}
        </p>
      )}

      {(phase === 'existed' || phase === 'created') && (
        <SetupNote tone="success" title={successCopy}>
          {keyPath && (
            <>
              {t('setup.crypto.pathLabel')}{' '}
              <span className="font-mono break-all text-foreground">{keyPath}</span>
            </>
          )}
        </SetupNote>
      )}

      {phase === 'error' && (
        <SetupNote tone="error" role="alert">{t('setup.crypto.error')}</SetupNote>
      )}
    </SetupCard>
  )
}
