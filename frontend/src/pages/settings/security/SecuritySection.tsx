import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, KeyRound } from 'lucide-react'
import { useMfaStatus } from '@/features/mfa/hooks'
import { cn } from '@/lib/utils'
import { ROW_BUTTON, SettingRow, SettingsCard } from '../SettingRow'
import { MfaEnrollDialog } from './MfaEnrollDialog'
import { MfaDisableDialog } from './MfaDisableDialog'
import { RecoveryCodesDialog } from './RecoveryCodesDialog'
import { SessionsList } from './SessionsList'
import { ExportDataDialog } from './ExportDataDialog'

/**
 * The Security section of Settings, three cards: two-factor authentication (status, enable or
 * disable, recovery codes), the "Remember me" devices, and the GDPR data export. Closing every
 * other session lives in the account section's sensitive zone.
 */
export function SecuritySection() {
  const { t } = useTranslation()
  const { data: status, isLoading } = useMfaStatus()
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [regenerateOpen, setRegenerateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  return (
    <>
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

      <SettingsCard title={t('settings.sessions')} description={t('settings.sessionsDescription')}>
        <SessionsList />
      </SettingsCard>

      <SettingsCard title={t('settings.dataTitle')}>
        <SettingRow label={t('settings.exportTitle')} description={t('settings.exportShortDesc')}>
          <Button variant="outline" size="xs" className={ROW_BUTTON} onClick={() => setExportOpen(true)}>
            <Download aria-hidden="true" />
            {t('settings.exportAction')}
          </Button>
        </SettingRow>
      </SettingsCard>

      <MfaEnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
      <MfaDisableDialog open={disableOpen} onOpenChange={setDisableOpen} />
      <RecoveryCodesDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} />
      <ExportDataDialog open={exportOpen} onOpenChange={setExportOpen} />
    </>
  )
}
