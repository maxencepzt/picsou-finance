import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EBSubstepShell } from './EBSubstepShell'
import { SetupNote } from '../../components/SetupCard'

interface Props {
  onNext: () => void
}

export function EBStep1Explain({ onNext }: Props) {
  const { t } = useTranslation()
  const [waitingOnSignup, setWaitingOnSignup] = useState(false)
  const [psd2Open, setPsd2Open] = useState(false)

  const handleHaveAccount = () => onNext()

  const handleCreateAccount = () => {
    window.open('https://enablebanking.com/sign-in/', '_blank', 'noopener,noreferrer')
    setWaitingOnSignup(true)
  }

  return (
    <EBSubstepShell
      current={1}
      total={5}
      title={t('setup.enablebanking.explain.title')}
      description={t('setup.enablebanking.explain.body')}
      footer={
        !waitingOnSignup ? (
          <>
            <Button variant="outline" onClick={handleCreateAccount} className="w-full sm:mr-auto sm:w-auto">
              <ExternalLink aria-hidden="true" />
              {t('setup.enablebanking.explain.needAccount')}
            </Button>
            <Button onClick={handleHaveAccount} className="w-full sm:w-auto">
              {t('setup.enablebanking.explain.haveAccount')}
            </Button>
          </>
        ) : (
          <Button onClick={onNext} className="w-full sm:w-auto">
            {t('setup.enablebanking.explain.continueAfterSignup')}
          </Button>
        )
      }
    >
      <div>
        <button
          type="button"
          onClick={() => setPsd2Open((v) => !v)}
          aria-expanded={psd2Open}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('setup.enablebanking.explain.psd2Popover')}
          <ChevronDown className={cn('size-4 transition-transform', psd2Open && 'rotate-180')} aria-hidden="true" />
        </button>
        {psd2Open && (
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {t('setup.enablebanking.explain.psd2Body')}
          </p>
        )}
      </div>

      <SetupNote tone="warning" title={t('setup.enablebanking.explain.prodWarningTitle')}>
        {t('setup.enablebanking.explain.prodWarningBody')}
      </SetupNote>

      <SetupNote>{t('setup.enablebanking.explain.psd2ScopeNote')}</SetupNote>

      {waitingOnSignup && (
        <SetupNote title={t('setup.enablebanking.explain.signupOpened')}>
          {t('setup.enablebanking.explain.magicLinkHint')}
        </SetupNote>
      )}
    </EBSubstepShell>
  )
}
