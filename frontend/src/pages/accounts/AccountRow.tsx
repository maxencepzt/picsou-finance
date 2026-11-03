import { useTranslation } from 'react-i18next'
import { Pencil, Trash2, TriangleAlert } from 'lucide-react'
import type { Account } from '@/types/api'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useMoney } from '@/hooks/use-money'
import { SYNC_FRESHNESS_BOUNDS_MS, VALUATION_FRESHNESS_BOUNDS_MS } from '@/lib/constants'
import { logoKeyUrl, providerLogoUrl } from '@/lib/provider-logos'
import { PROPERTY_KIND_ICONS } from '@/lib/property-icons'
import { cn, deriveMonogram, FRESHNESS_TEXT_CLASS, formatPercent, formatTimeAgo, freshnessLevel } from '@/lib/utils'
import { signedBalance } from './account-groups'

// The edit / delete buttons show on hover; a touch screen has no hover, so they stay visible
// there, and when keyboard focus is inside the row.
const ROW_ACTIONS_CLASS =
  'flex shrink-0 gap-1 pr-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity'

/** Freshness dot colour per level, matching FRESHNESS_TEXT_CLASS. */
const DOT_CLASS = { fresh: 'bg-gain', recent: 'bg-warning', stale: 'bg-warning', old: 'bg-loss', unknown: 'bg-muted-foreground' }

/** The account's logo when it has one (own key, connector, then provider map), else its monogram; a property shows its kind. */
function AccountMark({ account, small }: { account: Account; small?: boolean }) {
  const kind = account.type === 'REAL_ESTATE' ? account.realEstate?.propertyKind : null
  const size = small ? 'size-7' : 'size-9'
  if (kind) {
    const Icon = PROPERTY_KIND_ICONS[kind]
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-md bg-muted text-foreground', size)}>
        <Icon className="size-4" aria-hidden />
      </span>
    )
  }
  const src = logoKeyUrl(account.logoKey) ?? account.logoUrl ?? providerLogoUrl(account.provider)
  return (
    <Avatar className={cn('rounded-md after:rounded-md', src && 'bg-white', size)}>
      {src && <AvatarImage src={src} alt="" className="rounded-md object-contain p-1" />}
      <AvatarFallback className="rounded-md text-[11px] font-bold text-foreground">
        {deriveMonogram(account.name)}
      </AvatarFallback>
    </Avatar>
  )
}

interface AccountRowProps {
  account: Account
  /** Render time, from the page's lazy state: keeps `Date.now()` out of render. */
  now: number
  onOpen: () => void
  onEdit: () => void
  /** Absent for a pocket: it goes away with its wallet. */
  onDelete?: () => void
  /** A pocket under its wallet: smaller, indented. */
  nested?: boolean
}

/** One compact account line: mark, name, provider · freshness, balance, then edit / delete. */
export function AccountRow({ account, now, onOpen, onEdit, onDelete, nested }: AccountRowProps) {
  const { t } = useTranslation()
  const money = useMoney()
  const property = account.type === 'REAL_ESTATE' ? account.realEstate : undefined

  // A property is manual: its kind and city stand in for the provider, its valuation for the sync,
  // judged on the valuation scale (estimates refresh monthly).
  const subtitle = property
    ? [property.propertyKind && t(`property.kind.${property.propertyKind}`), property.city].filter(Boolean).join(' · ')
    : account.provider
  const freshness = property?.lastValuedAt
    ? { date: property.lastValuedAt, bounds: VALUATION_FRESHNESS_BOUNDS_MS }
    : account.lastSyncedAt
      ? { date: account.lastSyncedAt, bounds: SYNC_FRESHNESS_BOUNDS_MS }
      : null
  const level = freshness ? freshnessLevel(freshness.date, freshness.bounds, now) : 'unknown'
  // The warning tells the user to reconnect a dead session: meaningless for a figure typed by hand.
  const warn = !account.isManual && (level === 'stale' || level === 'old')

  const sub = [
    subtitle,
    freshness && !warn ? formatTimeAgo(freshness.date) : null,
    account.type === 'LOAN' && account.debt
      ? `${t('common.labelColon', { label: t('debt.borrowedAmount') })} ${money.amount(account.debt.borrowedAmount)}`
      : null,
  ].filter(Boolean).join(' · ')

  return (
    <li className={cn('group flex items-center rounded-xl transition-colors hover:bg-muted/50', nested && 'ml-6')}>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
        <AccountMark account={account} small={nested} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn('truncate font-semibold', nested ? 'text-[13px]' : 'text-sm')}>{account.name}</span>
            {/* Present only below 100%, so the balance is knowingly a shared figure. */}
            {account.sharePercent != null && (
              <span className="shrink-0 rounded-md bg-muted px-1.5 text-xs text-muted-foreground">
                {formatPercent(Number(account.sharePercent), { fractionDigits: 0 })}
              </span>
            )}
          </span>
          {(sub || warn) && (
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {freshness && <span className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[level])} aria-hidden />}
              {sub && <span className="truncate">{sub}</span>}
              {warn && freshness && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={cn('flex shrink-0 items-center gap-1', FRESHNESS_TEXT_CLASS[level])}>
                        {sub && <span aria-hidden>·</span>}
                        <TriangleAlert className="size-3 shrink-0" aria-hidden />
                        {t('accounts.syncStale', { time: formatTimeAgo(freshness.date) })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{t('accounts.syncStaleTooltip')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          )}
        </span>
        <CurrencyDisplay
          value={signedBalance(account)}
          className={cn('shrink-0 text-right font-semibold tabular-nums', nested ? 'text-sm' : 'text-[15px]')}
        />
      </button>
      <div className={ROW_ACTIONS_CLASS}>
        <Button variant="ghost" size="icon" className="size-7" aria-label={t('common.edit')} onClick={onEdit}>
          <Pencil className="size-3.5" />
        </Button>
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            aria-label={t('common.delete')}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </li>
  )
}
