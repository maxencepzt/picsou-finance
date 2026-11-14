import { useTranslation } from 'react-i18next'
import { Bitcoin } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useToggleIntegration } from '@/features/admin/hooks'
import { IntegrationMark } from '@/pages/setup/components/IntegrationMark'
import { SettingsCard } from '../components/SettingsBlocks'

const INTEGRATION_KEYS = ['enablebanking', 'boursobank', 'boursedirect', 'fortuneo', 'traderepublic', 'lbp', 'finary', 'crypto'] as const

export function IntegrationsSection({ integrations }: { integrations: Record<string, boolean> }) {
  const { t } = useTranslation()
  const toggle = useToggleIntegration()

  return (
    <SettingsCard title={t('admin.integrations.title')} description={t('admin.integrations.description')}>
      <ul className="divide-y divide-border">
        {INTEGRATION_KEYS.map((key) => {
          const label = t(`admin.integrations.${key}`)
          return (
            <li key={key} className="flex items-center gap-3 py-3">
              <IntegrationMark integration={key} label={label} icon={key === 'crypto' ? Bitcoin : undefined} className="size-8" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
              <Switch
                checked={integrations[key] ?? false}
                disabled={toggle.isPending}
                onCheckedChange={(enabled) => toggle.mutate({ key, enabled })}
                aria-label={label}
              />
            </li>
          )
        })}
      </ul>
    </SettingsCard>
  )
}
