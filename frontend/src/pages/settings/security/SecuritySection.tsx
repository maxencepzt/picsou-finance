import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, KeyRound } from 'lucide-react'
import { useMfaStatus } from '@/features/mfa/hooks'
import { ssoErrorMessage } from '@/features/sso/errors'
import { useSignInMethods } from '@/features/sso/hooks'
import { cn } from '@/lib/utils'
import { ROW_BUTTON, SettingRow, SettingsCard } from '../SettingRow'
import { MfaEnrollDialog } from './MfaEnrollDialog'
import { MfaDisableDialog } from './MfaDisableDialog'
import { RecoveryCodesDialog } from './RecoveryCodesDialog'
import { SessionsList } from './SessionsList'
import { ExportDataDialog } from './ExportDataDialog'
import type { ReauthAction } from './ReauthPanel'
import { LinkIdentityDialog, SignInMethodsCard } from './SignInMethodsCard'
import { RemovePasswordDialog } from './RemovePasswordDialog'
import { SetPasswordDialog } from './SetPasswordDialog'
import { UnlinkIdentityDialog } from './UnlinkIdentityDialog'

/** One-shot parameters the IdP round trips (re-authentication, linking) land back here with. */
const RETURN_PARAMS = ['resume', 'ssoError', 'sso'] as const

type Arrival =
  | { kind: 'none' }
  | { kind: 'ssoError'; code: string }
  | { kind: 'linked' }
  | { kind: 'resume'; action: ReauthAction }

function readArrival(params: URLSearchParams): Arrival {
  const code = params.get('ssoError')
  // A refused round trip never resumes the action it was meant to unlock.
  if (code) return { kind: 'ssoError', code }
  if (params.get('sso') === 'linked') return { kind: 'linked' }
  const action = parseResume(params.get('resume'))
  return action ? { kind: 'resume', action } : { kind: 'none' }
}

function parseResume(value: string | null): ReauthAction | null {
  switch (value) {
    case 'export':
    case 'remove-password':
    case 'set-password':
    case 'link':
      return value
  }
  const unlink = /^unlink-([1-9]\d*)$/.exec(value ?? '')
  return unlink ? `unlink-${Number(unlink[1])}` : null
}

interface OpenDialog {
  action: ReauthAction
  /** Reopened on the way back from the IdP re-authentication, so already confirmed. */
  resumed: boolean
}

/**
 * The Security section of Settings: the sign-in methods (password, linked SSO identities), two-factor
 * authentication (password accounts only: Picsou's TOTP only protects the password), the "Remember me"
 * devices, and the GDPR data export. Closing every other session lives in the account section's
 * sensitive zone. Back from an IdP round trip, it shows the outcome and resumes the confirmed action.
 */
export function SecuritySection() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [arrival] = useState(() => readArrival(searchParams))
  const [dialog, setDialog] = useState<OpenDialog | null>(() =>
    arrival.kind === 'resume' ? { action: arrival.action, resumed: true } : null,
  )
  const { data: status, isLoading } = useMfaStatus()
  const { data: methods } = useSignInMethods()
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  // Drop the one-shot parameters once read, so a reload cannot replay them.
  useEffect(() => {
    if (!RETURN_PARAMS.some(name => searchParams.has(name))) return
    setSearchParams(params => {
      RETURN_PARAMS.forEach(name => params.delete(name))
      return params
    }, { replace: true })
  }, [searchParams, setSearchParams])

  // The section sits below the fold: bring the outcome of the round trip into view.
  useEffect(() => {
    if (arrival.kind === 'ssoError' || arrival.kind === 'linked') {
      sectionRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [arrival])

  const openDialog = (action: ReauthAction) => setDialog({ action, resumed: false })
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null)
  }
  const resumedFor = (action: ReauthAction) => dialog?.action === action && dialog.resumed
  const unlinkTarget = methods?.identities.find(identity => dialog?.action === `unlink-${identity.id}`) ?? null

  return (
    <div ref={sectionRef} className="space-y-4">
      {arrival.kind === 'ssoError' && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {ssoErrorMessage(t, arrival.code)}
        </p>
      )}
      {arrival.kind === 'linked' && (
        <p role="status" className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">
          {t('settings.signInMethods.linked')}
        </p>
      )}

      <SignInMethodsCard onAction={openDialog} />

      {methods?.hasPassword && (
        <SettingsCard title={t('settings.mfaStatus')}>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <SettingRow
              label={
                <span className="inline-flex items-center gap-2">
                  <span className={cn('size-2 rounded-full', status?.enabled ? 'bg-gain' : 'bg-muted-foreground')} aria-hidden="true" />
                  {status?.enabled ? t('settings.mfaEnabled') : t('settings.mfaDisabled')}
                </span>
              }
              description={status?.enabled ? t('settings.mfaEnabledHint') : t('settings.mfaDisabledHint')}
            >
              {status?.enabled ? (
                <Button variant="destructive" size="xs" className={ROW_BUTTON} onClick={() => setDisableOpen(true)}>
                  {t('settings.mfaDisable')}
                </Button>
              ) : (
                <Button size="xs" className={ROW_BUTTON} onClick={() => setEnrollOpen(true)}>
                  {t('settings.mfaEnable')}
                </Button>
              )}
            </SettingRow>
          )}
          {status?.enabled && (
            <SettingRow
              label={t('settings.mfaRecoveryCodes')}
              description={t('settings.mfaRecoveryCodesRemaining', { count: status.remainingRecoveryCodes })}
            >
              <Button variant="outline" size="xs" className={ROW_BUTTON} onClick={() => setRegenerateOpen(true)}>
                <KeyRound aria-hidden="true" />
                {t('settings.mfaRegenerate')}
              </Button>
            </SettingRow>
          )}
        </SettingsCard>
      )}

      <SettingsCard title={t('settings.sessions')} description={t('settings.sessionsDescription')}>
        <SessionsList />
      </SettingsCard>

      <SettingsCard title={t('settings.dataTitle')}>
        <SettingRow label={t('settings.exportTitle')} description={t('settings.exportShortDesc')}>
          <Button variant="outline" size="xs" className={ROW_BUTTON} onClick={() => openDialog('export')}>
            <Download aria-hidden="true" />
            {t('settings.exportAction')}
          </Button>
        </SettingRow>
      </SettingsCard>

      <MfaEnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
      <MfaDisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <RecoveryCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
      <ExportDataDialog
        open={dialog?.action === 'export'}
        onOpenChange={closeDialog}
        resumed={resumedFor('export')}
      />
      {methods && (
        <>
          <RemovePasswordDialog
            open={dialog?.action === 'remove-password'}
            onOpenChange={closeDialog}
            resumed={resumedFor('remove-password')}
            providerName={methods.providerName}
          />
          <SetPasswordDialog
            open={dialog?.action === 'set-password'}
            onOpenChange={closeDialog}
            resumed={resumedFor('set-password')}
            providerName={methods.providerName}
          />
          <UnlinkIdentityDialog
            identity={unlinkTarget}
            onOpenChange={closeDialog}
            resumed={unlinkTarget !== null && resumedFor(`unlink-${unlinkTarget.id}`)}
            providerName={methods.providerName}
          />
          <LinkIdentityDialog
            open={dialog?.action === 'link'}
            onOpenChange={closeDialog}
            resumed={resumedFor('link')}
            providerName={methods.providerName}
            mfaEnabled={status?.enabled === true}
          />
        </>
      )}
    </div>
  )
}
