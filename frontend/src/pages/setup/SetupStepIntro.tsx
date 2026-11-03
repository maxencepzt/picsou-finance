import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { HelloGreeting } from './HelloGreeting'
import { useSetupStatus } from '@/features/setup/hooks'

/**
 * Step 0 of the wizard — the signature moment. After the Hello greeting
 * cycles through 12 locales, the welcome hero fades in with the single
 * "Get started" CTA.
 */
export function SetupStepIntro() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'greeting' | 'content'>('greeting')
  const { data: setupStatus } = useSetupStatus()

  return (
    <div className="relative">
      {phase === 'greeting' ? (
        <>
          <HelloGreeting onFinish={() => setPhase('content')} />
          <div className="mt-2 flex justify-center">
            <button
              type="button"
              onClick={() => setPhase('content')}
              aria-label={t('setup.intro.skipAria')}
              className="inline-flex min-h-10 items-center rounded-md px-3 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('setup.intro.skip')}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-6 text-center animate-hello-in">
          <h1 className="text-4xl leading-[1.05] font-bold tracking-tight text-balance text-foreground sm:text-[44px]">
            {t('setup.intro.title')}
          </h1>
          <p className="mx-auto max-w-md text-base text-pretty text-muted-foreground">
            {t('setup.intro.subtitle')}
          </p>
          <div className="pt-2">
            <Button
              onClick={() =>
                navigate(
                  setupStatus?.state === 'IN_PROGRESS' ? '/setup/security' : '/setup/admin'
                )
              }
              className="min-w-44"
            >
              {t('setup.intro.cta')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
