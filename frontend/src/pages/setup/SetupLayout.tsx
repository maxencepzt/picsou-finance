import { Outlet, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Fragment, useEffect, useMemo } from 'react'
import { Check } from 'lucide-react'
import picsouLogo from '@/assets/horizontal-white-picsou.svg'
import { cn } from '@/lib/utils'
import { SUPPORTED_LOCALES, resolveLocale } from '@/i18n/locales'

/**
 * Shell for every setup route: the logo and a compact language switch, a five-step
 * indicator, then the step itself (a card, except the welcome moment).
 *
 * The step counter comes from URL path, not a nav state, so a browser
 * refresh keeps the right index visible.
 */

const MAIN_STEPS: { path: string; i18nKey: string }[] = [
  { path: '/setup', i18nKey: 'setup.steps.hello' },
  { path: '/setup/admin', i18nKey: 'setup.steps.admin' },
  { path: '/setup/security', i18nKey: 'setup.steps.security' },
  { path: '/setup/integrations', i18nKey: 'setup.steps.integrations' },
  { path: '/setup/done', i18nKey: 'setup.steps.done' },
]

export function SetupLayout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const { index, total, label } = useMemo(() => {
    // Pick the longest-prefix match so sub-routes like /setup/integrations/enablebanking
    // resolve to the Integrations step, not Hello.
    const sorted = [...MAIN_STEPS].sort((a, b) => b.path.length - a.path.length)
    const match = sorted.find(s => location.pathname.startsWith(s.path))
      ?? MAIN_STEPS[0]
    const idx = MAIN_STEPS.findIndex(s => s.path === match.path)
    return { index: idx + 1, total: MAIN_STEPS.length, label: t(match.i18nKey) }
  }, [location.pathname, t])

  useEffect(() => {
    // Preload the Homemade Apple font only on setup routes — dashboard
    // users pay zero font-cost for the wizard's typography.
    const id = 'picsou-setup-font-preload'
    if (document.getElementById(id)) return
    const link = document.createElement('link')
    link.id = id
    link.rel = 'preload'
    link.as = 'font'
    link.type = 'font/woff2'
    link.crossOrigin = 'anonymous'
    link.href = '/fonts/HomemadeApple-Regular.woff2'
    document.head.appendChild(link)
  }, [])

  const activeLanguage = resolveLocale(i18n.language).code
  const switchLang = (lng: string) => {
    i18n.changeLanguage(lng)
  }

  return (
    // overflow-x-clip: the confetti of the last step flies past the screen edges.
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background">
      <a
        href="#setup-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:h-10 focus:items-center focus:rounded-md focus:bg-primary focus:px-6 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        {t('setup.a11y.skipToContent')}
      </a>

      <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 pt-5 sm:px-6 sm:pt-8">
        <img src={picsouLogo} alt="Picsou" className="h-6 w-auto brightness-0 dark:invert" />
        <div
          role="radiogroup"
          aria-label={t('setup.intro.language')}
          className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5"
        >
          {SUPPORTED_LOCALES.map((locale) => (
            <button
              key={locale.code}
              role="radio"
              type="button"
              aria-checked={activeLanguage === locale.code}
              onClick={() => switchLang(locale.code)}
              className={cn(
                'inline-flex h-8 min-w-9 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition-[background-color,color]',
                activeLanguage === locale.code
                  ? 'bg-card text-foreground ring-1 ring-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {locale.label}
            </button>
          ))}
        </div>
      </header>

      <nav aria-label={t('setup.progress.bar', { current: index, total })} className="mx-auto mt-8 w-full max-w-2xl px-4 sm:px-6">
        <ol className="flex items-center gap-2">
          {MAIN_STEPS.map((step, i) => {
            const state = i + 1 < index ? 'done' : i + 1 === index ? 'current' : 'upcoming'
            return (
              <Fragment key={step.path}>
                {i > 0 && (
                  <li aria-hidden="true" className={cn('h-px min-w-3 flex-1', i < index ? 'bg-primary' : 'bg-border')} />
                )}
                <li aria-current={state === 'current' ? 'step' : undefined} className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums',
                      state === 'done' && 'bg-primary text-primary-foreground',
                      state === 'current' && 'bg-card text-foreground ring-2 ring-primary',
                      state === 'upcoming' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {state === 'done' ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'hidden text-[13px] font-medium md:inline',
                      state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                    )}
                  >
                    {t(step.i18nKey)}
                  </span>
                </li>
              </Fragment>
            )
          })}
        </ol>
        <p className="mt-3 text-[13px] font-medium text-muted-foreground md:sr-only" aria-live="polite">
          {t('setup.progress.label', { current: index, total })} · <span className="text-foreground">{label}</span>
        </p>
      </nav>

      <main
        id="setup-main"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-12"
      >
        <div
          key={location.pathname}
          className="w-full animate-setup-slide-in"
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
