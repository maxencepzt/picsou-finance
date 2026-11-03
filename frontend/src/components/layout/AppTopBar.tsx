import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/shared/Kbd'
import { useAccounts } from '@/features/accounts/hooks'
import { useBankSyncStatus } from '@/features/sync/hooks'
import { useAppStore } from '@/stores/app-store'
import { cn, formatTimeAgo, localeFromLanguage } from '@/lib/utils'
import { modifierKeyLabel } from '@/lib/platform'
import picsouMark from '@/assets/picsou_logo_white.svg'
import { isNavActive } from './sidebar-nav-items'

/** The eye that blanks every amount in the app (privacy mode). */
export function PrivacyToggle({ className }: { className?: string }) {
  const { t } = useTranslation()
  const hideAmounts = useAppStore((s) => s.hideAmounts)
  const toggleHideAmounts = useAppStore((s) => s.toggleHideAmounts)
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-pressed={hideAmounts}
      aria-label={t(hideAmounts ? 'nav.showAmounts' : 'nav.hideAmounts')}
      onClick={toggleHideAmounts}
    >
      {hideAmounts ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
    </Button>
  )
}

/** "Me" and "Household": the personal pages, or the family view shared between members. */
function ScopeSwitch() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const household = isNavActive(pathname, '/family')
  const segment = (active: boolean) => cn(
    'inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold transition-[background-color,color]',
    active ? 'bg-card text-foreground ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
  )
  return (
    <div role="group" aria-label={t('topbar.scope')} className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
      <NavLink to="/" aria-current={household ? undefined : 'page'} className={segment(!household)}>{t('topbar.scopeMe')}</NavLink>
      <NavLink to="/family" aria-current={household ? 'page' : undefined} className={segment(household)}>{t('topbar.scopeHousehold')}</NavLink>
    </div>
  )
}

/** When the accounts last synced, and whether a connection needs attention. */
function SyncStatus() {
  const { t, i18n } = useTranslation()
  const { data: accounts } = useAccounts()
  const { data: connections } = useBankSyncStatus()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const failing = connections?.some((c) => c.status === 'FAILED') ?? false
  const latest = useMemo(() => {
    const dates = (accounts ?? []).filter((a) => !a.isManual && a.lastSyncedAt).map((a) => a.lastSyncedAt!)
    return dates.sort().at(-1) ?? null
  }, [accounts])
  if (!latest && !failing) return null
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className={cn('size-2 rounded-full', failing ? 'bg-warning' : 'bg-gain')} aria-hidden="true" />
      {failing ? t('topbar.syncAttention') : t('topbar.synced', { time: formatTimeAgo(latest, locale) })}
    </span>
  )
}

interface AppTopBarProps {
  onOpenSearch: () => void
  onSyncAll: () => void
}

export function AppTopBar({ onOpenSearch, onSyncAll }: AppTopBarProps) {
  const { t } = useTranslation()
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-border px-4 py-2 md:gap-3 md:px-6">
      <img src={picsouMark} alt="Picsou" className="size-7 shrink-0 brightness-0 md:hidden dark:invert" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-10 max-w-md min-w-0 flex-1 items-center gap-2 rounded-md bg-muted px-3 text-left text-sm text-muted-foreground ring-1 ring-border transition-[box-shadow,color] hover:text-foreground hover:ring-input md:flex"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{t('topbar.search')}</span>
        <span className="flex shrink-0 gap-1" aria-hidden="true">
          <Kbd>{modifierKeyLabel()}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <div className="ml-auto flex items-center gap-1 md:gap-3">
        <div className="hidden sm:block"><ScopeSwitch /></div>
        <div className="hidden lg:block"><SyncStatus /></div>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('topbar.search')} onClick={onOpenSearch}>
          <Search className="size-4" aria-hidden="true" />
        </Button>
        <PrivacyToggle />
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('dashboard.syncAccounts')} onClick={onSyncAll}>
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
        <Button className="hidden md:inline-flex" onClick={onSyncAll}>
          <RefreshCw aria-hidden="true" />
          {t('dashboard.syncAccounts')}
        </Button>
      </div>
    </header>
  )
}
