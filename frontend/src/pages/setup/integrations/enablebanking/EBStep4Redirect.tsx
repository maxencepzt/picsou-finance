import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EBSubstepShell } from './EBSubstepShell'
import { useSetupFlowStore } from '@/stores/setup-flow-store'
import { SetupNote } from '../../components/SetupCard'

interface Props {
  onNext: () => void
  onBack: () => void
}

export function EBStep4Redirect({ onNext, onBack }: Props) {
  const { t } = useTranslation()
  const draft = useSetupFlowStore((s) => s.ebDraft)

  const redirectUri =
    draft.redirectUri ||
    (typeof window !== 'undefined' ? `${window.location.origin}/sync/callback` : '')

  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* noop — user can Ctrl+C from the readonly input */
    }
  }

  return (
    <EBSubstepShell
      current={2}
      total={5}
      title={t('setup.enablebanking.redirect.title')}
      description={t('setup.enablebanking.redirect.body')}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack} className="w-full sm:mr-auto sm:w-auto">
            {t('setup.enablebanking.back')}
          </Button>
          <Button onClick={onNext} className="w-full sm:w-auto">
            {t('setup.enablebanking.redirect.addedCta')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label={t('setup.enablebanking.redirect.uriLabel')}
          readOnly
          value={redirectUri}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-10 w-full min-w-0 rounded-xl bg-muted px-4 font-mono text-[13px] text-foreground outline-none"
        />
        <Button type="button" variant="outline" onClick={handleCopy} className="shrink-0 sm:min-w-36">
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? t('setup.enablebanking.redirect.copied') : t('setup.enablebanking.redirect.copy')}
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">{t('setup.enablebanking.redirect.checklistTitle')}</h3>
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-5 text-muted-foreground marker:text-muted-foreground">
          <li>{t('setup.enablebanking.redirect.environment')}</li>
          <li>{t('setup.enablebanking.redirect.name')}</li>
          <li>{t('setup.enablebanking.redirect.description')}</li>
          <li>{t('setup.enablebanking.redirect.email')}</li>
          <li>
            {t('setup.enablebanking.redirect.policyUrls')}
            <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <a className="font-medium text-primary underline-offset-4 hover:underline" href="https://github.com/Cloeille/picsou-finance/blob/main/SECURITY.md" target="_blank" rel="noopener noreferrer">SECURITY.md</a>
              <a className="font-medium text-primary underline-offset-4 hover:underline" href="https://github.com/Cloeille/picsou-finance/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">LICENSE</a>
            </span>
          </li>
          <li>{t('setup.enablebanking.redirect.keyMethod')}</li>
        </ul>
      </section>

      <SetupNote title={t('setup.enablebanking.redirect.activationTitle')}>
        <p>{t('setup.enablebanking.redirect.activationBody')}</p>
        <p className="mt-1">{t('setup.enablebanking.redirect.restrictedMode')}</p>
      </SetupNote>
    </EBSubstepShell>
  )
}
