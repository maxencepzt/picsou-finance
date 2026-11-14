import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { ComponentType } from 'react'
import { Bitcoin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IntegrationCard } from './components/IntegrationCard'
import { IntegrationMark } from './components/IntegrationMark'
import { SetupCard } from './components/SetupCard'
import { useSetupFlowStore, type IntegrationKey } from '@/stores/setup-flow-store'

/**
 * Ordered catalog — consumed here and later in Settings → Integrations.
 * The order also drives the sub-step navigation: after "Continue" we route
 * to the first *selected* integration in this exact sequence, so the user
 * always gets a predictable path regardless of tick order.
 */
const CATALOG: Array<{
  key: IntegrationKey
  /** Only for a category without a brand to monogram. */
  icon?: ComponentType<{ className?: string }>
  route: string
}> = [
  { key: 'enablebanking', route: '/setup/integrations/enablebanking' },
  { key: 'boursobank', route: '/setup/integrations/boursobank' },
  { key: 'boursedirect', route: '/setup/integrations/boursedirect' },
  { key: 'fortuneo', route: '/setup/integrations/fortuneo' },
  { key: 'traderepublic', route: '/setup/integrations/traderepublic' },
  { key: 'lbp', route: '/setup/integrations/lbp' },
  { key: 'revolut', route: '/setup/integrations/revolut' },
  { key: 'finary', route: '/setup/integrations/finary' },
  { key: 'crypto', icon: Bitcoin, route: '/setup/integrations/crypto' },
]

export function SetupStepIntegrations() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const selected = useSetupFlowStore((s) => s.selectedIntegrations)
  const toggle = useSetupFlowStore((s) => s.toggleIntegration)

  const count = selected.length

  /**
   * Determine which screen to push to next. The `CATALOG` array is the
   * canonical ordering — we find the first selected entry in that order,
   * not in the toggle-click order. If nothing selected, we hop straight
   * to the Done screen with nothing flipped server-side.
   */
  const handleContinue = () => {
    const firstSelected = CATALOG.find((c) => selected.includes(c.key))
    if (firstSelected) {
      navigate(firstSelected.route)
    } else {
      navigate('/setup/done')
    }
  }

  const hintKey =
    count === 0
      ? 'setup.integrations.hint.none'
      : count === 1
        ? 'setup.integrations.hint.some'
        : 'setup.integrations.hint.some_other'

  return (
    <SetupCard
      title={t('setup.integrations.title')}
      description={t('setup.integrations.subtitle')}
      footer={
        <>
          <p className="text-center text-[13px] text-muted-foreground sm:mr-auto sm:text-left" aria-live="polite">
            {t(hintKey, { count })}
          </p>
          <Button onClick={handleContinue} className="w-full sm:w-auto">
            {count === 0 ? t('setup.integrations.skipAll') : t('setup.integrations.continue')}
          </Button>
        </>
      }
    >
      <div className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-border">
        {CATALOG.map(({ key, icon }) => {
          const title = t(`setup.integrations.cards.${key}.title`)
          return (
            <IntegrationCard
              key={key}
              mark={<IntegrationMark integration={key} label={title} icon={icon} />}
              title={title}
              description={t(`setup.integrations.cards.${key}.description`)}
              checked={selected.includes(key)}
              onToggle={() => toggle(key)}
            />
          )
        })}
      </div>
    </SetupCard>
  )
}
