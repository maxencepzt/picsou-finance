import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SetupSsoInfo } from '@/features/setup/api'
import { submitSsoStart } from '@/features/sso/start'
import { SetupNote } from './components/SetupCard'

/** The admin step when the first admin must come from the SSO admin group. */
export function SetupAdminSso({ sso }: { sso: SetupSsoInfo }) {
  const { t } = useTranslation()

  if (!sso.enabled) {
    return (
      <SetupNote tone="error" role="alert">
        {t('setup.admin.ssoMisconfigured')}
      </SetupNote>
    )
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('setup.admin.ssoHint', { provider: sso.providerName })}
      </p>
      <Button
        type="button"
        onClick={() => submitSsoStart({ intent: 'setup' })}
        className="h-auto min-h-10 w-full whitespace-normal sm:w-auto"
      >
        <KeyRound aria-hidden="true" />
        {t('setup.admin.ssoContinue', { provider: sso.providerName })}
      </Button>
    </div>
  )
}
