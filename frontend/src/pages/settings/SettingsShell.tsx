import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/shared/PageHeader'
import { NativeSelect } from '@/components/shared/NativeSelect'
import { cn } from '@/lib/utils'
import { SETTINGS_SECTIONS, settingsSectionHref, type SettingsSectionId } from './settings-sections'

/**
 * The settings frame: the section list (a sticky column on desktop, a select on smaller screens)
 * and the active section with its heading. One section shows at a time, deep-linkable by URL.
 */
export function SettingsShell({ active, children }: { active: SettingsSectionId; children: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const headingRef = useRef<HTMLDivElement>(null)
  const section = SETTINGS_SECTIONS.find((s) => s.id === active) ?? SETTINGS_SECTIONS[0]

  // Switching from deep inside a long section would otherwise open the next one mid-page.
  useEffect(() => {
    headingRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  return (
    <div>
      <PageHeader title={t('settings.title')} />
      <div className="grid gap-4 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <nav aria-label={t('settings.sectionsNav')} className="hidden lg:sticky lg:top-0 lg:block">
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map(({ id, labelKey, icon: Icon }) => {
              const current = id === active
              return (
                <li key={id}>
                  <Link
                    to={settingsSectionHref(id)}
                    replace
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-[background-color,color]',
                      current ? 'bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', current && 'text-primary')} aria-hidden="true" />
                    <span className="truncate">{t(labelKey)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="lg:hidden">
          <label htmlFor="settings-section" className="sr-only">{t('settings.sectionsNav')}</label>
          <NativeSelect
            id="settings-section"
            value={active}
            onChange={(e) => navigate(settingsSectionHref(e.target.value as SettingsSectionId), { replace: true })}
            className="font-medium"
          >
            {SETTINGS_SECTIONS.map(({ id, labelKey }) => (
              <option key={id} value={id}>{t(labelKey)}</option>
            ))}
          </NativeSelect>
        </div>

        <section aria-labelledby="settings-section-title" className="min-w-0 space-y-4">
          <div ref={headingRef} className="scroll-mt-4">
            {/* On smaller screens the select above already names the section. */}
            <h2 id="settings-section-title" className="text-base font-semibold text-foreground max-lg:sr-only">
              {t(section.labelKey)}
            </h2>
            <p className="text-sm text-muted-foreground">{t(section.descriptionKey)}</p>
          </div>
          {children}
        </section>
      </div>
    </div>
  )
}
