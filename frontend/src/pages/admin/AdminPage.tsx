import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, BrainCircuit, Landmark, Plug, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { useAdminSettings } from '@/features/admin/hooks'
import { cn } from '@/lib/utils'
import { SecuritySection } from './sections/SecuritySection'
import { EnableBankingSection } from './sections/EnableBankingSection'
import { AiCategorizationSection } from './sections/AiCategorizationSection'
import { IntegrationsSection } from './sections/IntegrationsSection'
import { MembersSection } from './sections/MembersSection'
import { AiActivitySection } from './sections/AiActivitySection'
import { TelemetrySection } from './sections/TelemetrySection'
import { EnableBankingDebugSection } from './sections/EnableBankingDebugSection'

const SECTIONS = [
  { id: 'members', labelKey: 'admin.members.title', icon: Users },
  { id: 'security', labelKey: 'admin.security.title', icon: ShieldCheck },
  { id: 'enable-banking', labelKey: 'admin.enableBanking.title', icon: Landmark },
  { id: 'ai', labelKey: 'admin.nav.ai', icon: BrainCircuit },
  { id: 'integrations', labelKey: 'admin.integrations.title', icon: Plug },
  { id: 'telemetry', labelKey: 'admin.nav.telemetry', icon: Activity },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

/** Highlights the section the reader is in: the topmost one crossing the upper third of the screen. */
function useActiveSection(enabled: boolean): [SectionId, (id: SectionId) => void] {
  const [active, setActive] = useState<SectionId>(SECTIONS[0].id)
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return
    // Each callback only reports the sections that changed, so keep the full visible set.
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        }
        const first = SECTIONS.find((s) => visible.has(s.id))
        if (first) setActive(first.id)
      },
      { rootMargin: '0px 0px -66% 0px' },
    )
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [enabled])
  return [active, setActive]
}

export function AdminPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useAdminSettings()
  const [active, setActive] = useActiveSection(!!data)

  if (isLoading) return <LoadingSkeleton />

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: SectionId) => {
    e.preventDefault()
    setActive(id)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  const link = (id: SectionId, labelKey: string, Icon: (typeof SECTIONS)[number]['icon'], row: boolean) => (
    <a
      href={`#${id}`}
      onClick={(e) => jump(e, id)}
      aria-current={active === id ? 'location' : undefined}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
        row ? 'h-10 px-3' : 'h-9 px-3',
        active === id ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={cn('size-4 shrink-0', active === id && 'text-primary', !row && 'hidden')} aria-hidden="true" />
      {t(labelKey)}
    </a>
  )

  return (
    <div>
      <PageHeader title={t('admin.title')} />
      {data && (
        <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
          <nav aria-label={t('admin.nav.label')} className="mb-6 lg:sticky lg:top-6 lg:mb-0">
            <ScrollStrip className="lg:hidden">
              <ul className="flex w-max gap-1">
                {SECTIONS.map(({ id, labelKey, icon }) => (
                  <li key={id}>{link(id, labelKey, icon, false)}</li>
                ))}
              </ul>
            </ScrollStrip>
            <ul className="hidden flex-col gap-0.5 lg:flex">
              {SECTIONS.map(({ id, labelKey, icon }) => (
                <li key={id}>{link(id, labelKey, icon, true)}</li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 max-w-3xl space-y-8 [&>section]:scroll-mt-6 [&>section]:space-y-4">
            <section id="members" aria-label={t('admin.members.title')}>
              <MembersSection />
            </section>
            <section id="security" aria-label={t('admin.security.title')}>
              <SecuritySection settings={data.security} />
            </section>
            <section id="enable-banking" aria-label={t('admin.enableBanking.title')}>
              <EnableBankingSection settings={data.enableBanking} />
              <EnableBankingDebugSection />
            </section>
            <section id="ai" aria-label={t('admin.nav.ai')}>
              <AiCategorizationSection settings={data.ai} />
              <AiActivitySection />
            </section>
            <section id="integrations" aria-label={t('admin.integrations.title')}>
              <IntegrationsSection integrations={data.integrations} />
            </section>
            <section id="telemetry" aria-label={t('admin.nav.telemetry')}>
              <TelemetrySection settings={data.telemetry} />
            </section>
          </div>
        </div>
      )}
    </div>
  )
}
