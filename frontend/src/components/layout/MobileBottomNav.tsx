import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { CLASSIC_SETTINGS_NAV_ITEM, FAMILY_NAV_ITEM, NAV_ITEMS, SYNC_NAV_ITEM, isNavActive, type NavEntry } from './sidebar-nav-items'

/**
 * Five labelled entries: the four destinations used most, then "More" for the rest of the
 * sidebar plus Family, Sync and Settings, which mobile reaches no other way. Every target stays
 * at least 44px tall.
 */
const PRIMARY_PATHS = ['/', '/accounts', '/investments', '/budget']
const PRIMARY_ITEMS = NAV_ITEMS.filter((item) => PRIMARY_PATHS.includes(item.path))
const MORE_ITEMS: NavEntry[] = [
  ...NAV_ITEMS.filter((item) => !PRIMARY_PATHS.includes(item.path)),
  FAMILY_NAV_ITEM,
  SYNC_NAV_ITEM,
  CLASSIC_SETTINGS_NAV_ITEM,
]
/** Shorter labels where the sidebar's would not fit a fifth of a phone. */
const SHORT_LABEL: Record<string, string> = { '/investments': 'nav.investShort' }

function BarItem({ active, icon: Icon, label, ...rest }: { active: boolean; icon: LucideIcon; label: string } & (
  { to: string; onClick?: never } | { to?: never; onClick: () => void }
)) {
  const className = cn(
    'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] transition-[background-color,color]',
    active ? 'bg-primary/12 font-semibold text-foreground' : 'font-medium text-muted-foreground',
  )
  const icon = <Icon className={cn('size-5', active && 'text-primary')} aria-hidden="true" />
  if (rest.to != null) {
    return (
      <NavLink to={rest.to} end={rest.to === '/'} aria-current={active ? 'page' : undefined} className={className}>
        {icon}
        <span>{label}</span>
      </NavLink>
    )
  }
  return (
    <button type="button" onClick={rest.onClick} aria-current={active ? 'page' : undefined} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

export function MobileBottomNav() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = MORE_ITEMS.some((item) => isNavActive(pathname, item.path))

  return (
    <nav aria-label={t('nav.main')} className="fixed bottom-4 inset-x-4 z-50 md:hidden">
      <div className="flex items-center gap-1 rounded-xl bg-sidebar p-1.5 ring-1 ring-border">
        {PRIMARY_ITEMS.map((item) => (
          <BarItem
            key={item.path}
            to={item.path}
            active={isNavActive(pathname, item.path)}
            icon={item.icon}
            label={t(SHORT_LABEL[item.path] ?? item.labelKey)}
          />
        ))}
        <BarItem active={moreActive} icon={MoreHorizontal} label={t('nav.more')} onClick={() => setMoreOpen(true)} />
      </div>
      {/* iOS safe area */}
      <div className="h-[env(safe-area-inset-bottom)]" />

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{t('nav.more')}</SheetTitle>
            <SheetDescription className="sr-only">{t('nav.moreDescription')}</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {MORE_ITEMS.map((item) => {
              const active = isNavActive(pathname, item.path)
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium',
                    active ? 'bg-primary/12 text-foreground' : 'bg-muted text-foreground',
                  )}
                >
                  <Icon className={cn('size-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
                  <span className="truncate">{t(item.labelKey)}</span>
                </NavLink>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
