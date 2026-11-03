import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useUpdateTelemetry } from '@/features/admin/hooks'
import { shutdownTelemetry } from '@/lib/telemetry'
import type { TelemetrySettings } from '@/types/api'
import { SettingRow, SettingsCard } from '../components/SettingsBlocks'

export function TelemetrySection({ settings }: { settings: TelemetrySettings }) {
  const { t } = useTranslation()
  const update = useUpdateTelemetry()

  function onToggle(enabled: boolean) {
    update.mutate(enabled, {
      // Stop reporting right now rather than waiting for the config refetch.
      onSuccess: () => { if (!enabled) shutdownTelemetry() },
      onError: () => toast.error(t('telemetry.section.error')),
    })
  }

  return (
    <SettingsCard
      title={t('telemetry.section.title')}
      description={t('telemetry.section.description')}
    >
      <SettingRow toggle htmlFor="admin-telemetry" label={t('telemetry.section.toggle')} description={t('telemetry.section.privacy')}>
        <Switch
          id="admin-telemetry"
          checked={settings.available && settings.consent === 'ENABLED'}
          disabled={!settings.available || update.isPending}
          onCheckedChange={onToggle}
          aria-label={t('telemetry.section.toggle')}
        />
      </SettingRow>
      {!settings.available && (
        <p className="py-4 text-[13px] text-muted-foreground">{t('telemetry.section.unavailable')}</p>
      )}
    </SettingsCard>
  )
}
