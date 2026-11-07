import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import { APP_VERSION } from '@/lib/app-version'
import { SettingsShell } from './SettingsShell'
import { SettingRow, SettingsCard } from './SettingRow'
import { resolveSettingsSection } from './settings-sections'
import { AppearanceSection } from './sections/AppearanceSection'
import { AccountSection } from './sections/AccountSection'
import { ProfileSection } from './sections/ProfileSection'
import { SecuritySection } from './security/SecuritySection'
import { AccessKeysSection } from './sections/AccessKeysSection'
import { ConnectedAppsSection } from './sections/ConnectedAppsSection'

function AboutSection() {
  const { t } = useTranslation()
  return (
    <SettingsCard>
      <SettingRow label={t('settings.application')} className="flex-row items-center justify-between">
        <span className="text-sm font-medium text-foreground">Picsou</span>
      </SettingRow>
      <SettingRow label={t('settings.version')} className="flex-row items-center justify-between">
        <span className="text-sm font-medium tabular-nums text-foreground">{APP_VERSION}</span>
      </SettingRow>
      <SettingRow label="GitHub" className="flex-row items-center justify-between">
        <a
          href="https://github.com/cloeille/picsou-finance"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <span className="truncate">cloeille/picsou-finance</span>
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      </SettingRow>
    </SettingsCard>
  )
}

/** /settings: one section at a time, chosen by `?section=` (appearance when absent). */
export function SettingsPage() {
  const [params] = useSearchParams()
  const section = resolveSettingsSection(params.get('section'))

  return (
    <SettingsShell active={section}>
      {section === 'appearance' && <AppearanceSection />}
      {section === 'account' && <AccountSection />}
      {section === 'profile' && <ProfileSection />}
      {section === 'security' && <SecuritySection />}
      {section === 'mcp' && (
        <>
          <AccessKeysSection />
          <ConnectedAppsSection />
        </>
      )}
      {section === 'about' && <AboutSection />}
    </SettingsShell>
  )
}
