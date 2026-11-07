import { useMemo, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, RefreshCw, Search, Settings, type LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { HoldingLogo } from '@/components/shared/HoldingLogo'
import { Kbd } from '@/components/shared/Kbd'
import { useAccounts, usePortfolio } from '@/features/accounts/hooks'
import { useAppStore } from '@/stores/app-store'
import { accountTypeLabelKey } from '@/lib/constants'
import { logoKeyUrl, providerLogoUrl } from '@/lib/provider-logos'
import { cn, deriveMonogram, normalizeSearch } from '@/lib/utils'
import { modifierKeyLabel } from '@/lib/platform'
import { FAMILY_NAV_ITEM, NAV_ITEMS, SYNC_NAV_ITEM } from './sidebar-nav-items'

type PaletteItem = {
  id: string
  group: 'pages' | 'accounts' | 'holdings' | 'actions'
  label: string
  hint?: string
  icon?: LucideIcon
  monogram?: string
  /** An account's bundled or provider logo, the monogram standing in when it fails. */
  logo?: string | null
  /** A security's mark, drawn by `HoldingLogo`. */
  holding?: { logoUrl: string | null | undefined; logoUrlDark?: string | null; ticker: string }
  amount?: number
  run: () => void
}

const MAX_PER_GROUP = 5

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSyncAll: () => void
}

export function CommandPalette({ open, onOpenChange, onSyncAll }: CommandPaletteProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-24 max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 text-sm shadow-2xl sm:max-w-xl"
      >
        {/* Mounted only while open: the query and the selection start fresh each time. */}
        {open && <PaletteBody onClose={() => onOpenChange(false)} onSyncAll={onSyncAll} />}
      </DialogContent>
    </Dialog>
  )
}

function PaletteBody({ onClose, onSyncAll }: { onClose: () => void; onSyncAll: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const hideAmounts = useAppStore((s) => s.hideAmounts)
  const toggleHideAmounts = useAppStore((s) => s.toggleHideAmounts)
  const { data: accounts = [] } = useAccounts()
  const { data: portfolio = [] } = usePortfolio()

  const items = useMemo<PaletteItem[]>(() => {
    const go = (path: string) => () => { onClose(); navigate(path) }
    const pages: PaletteItem[] = [...NAV_ITEMS, FAMILY_NAV_ITEM, SYNC_NAV_ITEM].map((item) => ({
      id: `page:${item.path}`, group: 'pages', label: t(item.labelKey), icon: item.icon, run: go(item.path),
    }))
    const accountItems: PaletteItem[] = accounts.map((account) => ({
      id: `account:${account.id}`,
      group: 'accounts',
      label: account.name,
      hint: t(accountTypeLabelKey(account.type)),
      monogram: deriveMonogram(account.name),
      logo: logoKeyUrl(account.logoKey) ?? account.logoUrl ?? providerLogoUrl(account.provider),
      amount: account.currentBalanceEur,
      run: go(`/accounts/${account.id}`),
    }))
    const holdingItems: PaletteItem[] = portfolio
      .filter((line) => line.ticker)
      .map((line) => ({
        id: `holding:${line.id}`,
        group: 'holdings',
        label: line.name,
        hint: [line.ticker, line.accountName].filter(Boolean).join(' · '),
        holding: { logoUrl: line.logoUrl, logoUrlDark: line.logoUrlDark, ticker: line.ticker ?? '' },
        amount: line.valueEur,
        run: go(`/accounts/${line.accountId}`),
      }))
    const actions: PaletteItem[] = [
      { id: 'action:sync', group: 'actions', label: t('palette.syncAll'), icon: RefreshCw, run: () => { onClose(); onSyncAll() } },
      {
        id: 'action:amounts',
        group: 'actions',
        label: t(hideAmounts ? 'nav.showAmounts' : 'nav.hideAmounts'),
        icon: hideAmounts ? Eye : EyeOff,
        run: () => { toggleHideAmounts(); onClose() },
      },
      { id: 'action:settings', group: 'actions', label: t('nav.settings'), icon: Settings, run: go('/settings') },
    ]

    const q = normalizeSearch(query)
    if (!q) return [...actions, ...pages]
    const match = (item: PaletteItem) => normalizeSearch(`${item.label} ${item.hint ?? ''}`).includes(q)
    return [
      ...holdingItems.filter(match).slice(0, MAX_PER_GROUP),
      ...accountItems.filter(match).slice(0, MAX_PER_GROUP),
      ...actions.filter(match),
      ...pages.filter(match),
    ]
  }, [accounts, portfolio, query, hideAmounts, t, navigate, onClose, onSyncAll, toggleHideAmounts])

  const activeIndex = Math.min(active, Math.max(items.length - 1, 0))

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (items.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((activeIndex + step + items.length) % items.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      items[activeIndex]?.run()
    }
  }

  const groups: PaletteItem['group'][] = ['holdings', 'accounts', 'actions', 'pages']

  return (
    <>
      <DialogTitle className="sr-only">{t('palette.title')}</DialogTitle>
      <DialogDescription className="sr-only">{t('palette.description')}</DialogDescription>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={items[activeIndex] ? `palette-${items[activeIndex].id}` : undefined}
          aria-label={t('palette.title')}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          // The palette is the focus: the global focus halo would draw a box cut by the header's edges.
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground shadow-none outline-none placeholder:text-muted-foreground"
        />
        {/* A keycap on a keyboard, and the way out on a phone, which has no Esc key. */}
        <button type="button" onClick={onClose} aria-label={t('common.close')} className="-mr-2 flex min-h-10 min-w-10 items-center justify-center rounded-md">
          <Kbd>{t('palette.esc')}</Kbd>
        </button>
      </div>

      <div id="palette-results" role="listbox" aria-label={t('palette.title')} className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
        {items.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('common.noResults')}</p>
        )}
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.group === group)
          if (groupItems.length === 0) return null
          return (
            <div key={group} role="group" aria-label={t(`palette.groups.${group}`)}>
              <p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground">{t(`palette.groups.${group}`)}</p>
              {groupItems.map((item) => {
                const position = items.indexOf(item)
                const selected = position === activeIndex
                return (
                  <div
                    key={item.id}
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setActive(position)}
                    onClick={item.run}
                    className={cn(
                      'grid cursor-pointer grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-md px-3 py-2',
                      selected && 'bg-primary/12',
                    )}
                  >
                    {item.holding ? (
                      <HoldingLogo {...item.holding} name={item.label} className="size-8" />
                    ) : item.icon ? (
                      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-foreground">
                        <item.icon className="size-4" aria-hidden="true" />
                      </span>
                    ) : (
                      <Avatar className={cn('size-8 rounded-md after:rounded-md', item.logo && 'bg-white')}>
                        {item.logo && <AvatarImage src={item.logo} alt="" className="rounded-md object-contain p-1" />}
                        <AvatarFallback className="rounded-md text-[11px] font-bold text-foreground">{item.monogram}</AvatarFallback>
                      </Avatar>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>}
                    </span>
                    {item.amount != null && (
                      <CurrencyDisplay value={item.amount} className="text-sm font-semibold tabular-nums text-foreground" />
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:flex">
        <span className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd>{t('palette.navigate')}</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>↵</Kbd>{t('palette.open')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>{modifierKeyLabel()}</Kbd><Kbd>K</Kbd>{t('palette.anywhere')}
        </span>
      </div>
    </>
  )
}
