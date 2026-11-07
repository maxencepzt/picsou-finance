import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { PageHeader } from '@/components/shared/PageHeader'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { cn } from '@/lib/utils'
import { useUncategorized } from '@/features/budget/hooks'
import { BUDGET_NAV } from './budget-nav'
import { BudgetPeriodProvider } from './BudgetPeriodContext'

/**
 * Shell for the whole Budget section. Replaces the former single-page / in-page-tabs
 * design with proper nested routes (`/budget`, `/budget/spending`, …) so each surface
 * is deep-linkable, lazily code-split and back-button friendly.
 *
 * The sub-nav is a horizontally-scrollable segmented control — it reads as a pill row
 * on desktop and stays fully reachable by swipe on narrow phones (no second bottom bar
 * competing with the global MobileBottomNav), with the current section scrolled into view.
 */
export function BudgetLayout() {
  const { t } = useTranslation()
  const location = useLocation()
  const { data: uncategorized } = useUncategorized()
  const toReview = uncategorized?.length ?? 0

  return (
    <div>
      <PageHeader surtitle={t('budget.surtitle')} title={t('budget.title')} />

      {/* The page-level switch: the SegmentedControl look (muted track, selected on the card
          surface with a hairline) at the 40px page rhythm. */}
      <ScrollStrip activeKey={location.pathname}>
        <nav aria-label={t('budget.title')} className="flex w-max gap-0.5 rounded-lg bg-muted p-1 text-muted-foreground">
          {BUDGET_NAV.map(({ section, to, end, labelKey, icon: Icon, badge }) => (
            <NavLink
              key={section}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-[background-color,color]',
                  isActive
                    ? 'bg-card text-foreground ring-1 ring-border'
                    : 'hover:text-foreground',
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{t(labelKey)}</span>
              {badge && toReview > 0 && (
                <span className="min-w-5 rounded-full bg-warning/15 px-1.5 text-center text-xs font-semibold tabular-nums text-warning">
                  {toReview}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </ScrollStrip>

      {/* Provider mounts outside the keyed div so the anchor survives tab switches.
          The keyed div still remounts per path (entrance animation, local page state reset)
          but BudgetPeriodProvider stays alive for the whole /budget section. */}
      <BudgetPeriodProvider>
        <div key={location.pathname} className="mt-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
          <Outlet />
        </div>
      </BudgetPeriodProvider>
    </div>
  )
}
