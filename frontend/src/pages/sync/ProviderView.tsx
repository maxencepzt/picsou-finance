import { useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BankSyncTab } from './BankSyncTab'
import { CryptoExchangeTab } from './CryptoExchangeTab'
import { CryptoWalletTab } from './CryptoWalletTab'
import { TradeRepublicTab } from './TradeRepublicTab'
import { RevolutTab } from './RevolutTab'
import { IbkrTab } from './IbkrTab'
import { SimplefinTab } from './SimplefinTab'
import { FinaryTab } from './FinaryTab'
import { HomeBankTab } from './HomeBankTab'
import { BourseDirectTab } from './BourseDirectTab'
import { AccountsVisibilityTab } from './AccountsVisibilityTab'
import { DegiroTab } from './DegiroTab'
import { AmundiTab } from './AmundiTab'
import { CmesTab } from './CmesTab'
import { CicTab } from './CicTab'
import { LbpTab } from './LbpTab'
import { BnpTab } from './BnpTab'
import { NatixisTab } from './NatixisTab'
import { AmexTab } from './AmexTab'
import { CorumTab } from './CorumTab'
import { SofidyTab } from './SofidyTab'
import { BoursoTab } from './BoursoTab'
import { CaisseEpargneTab } from './CaisseEpargneTab'
import { BanquePopulaireTab } from './BanquePopulaireTab'
import { WiseTab } from './WiseTab'
import { FortuneoTab } from './FortuneoTab'
import { ActualBudgetTab } from './ActualBudgetTab'
import { VISIBILITY_VIEW, catalogEntry, type ViewKey } from './catalog'
import { SyncLine } from './ConnectionRow'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { needsReconnect, useSyncConnections } from './use-sync-connections'

/** Each `?tab=` key and the panel its view renders; the type makes a catalog entry without one a compile error. */
const VIEW_PANELS: Record<ViewKey, ComponentType> = {
  banks: BankSyncTab,
  exchanges: CryptoExchangeTab,
  wallets: CryptoWalletTab,
  tr: TradeRepublicTab,
  revolut: RevolutTab,
  bourso: BoursoTab,
  'caisse-epargne': CaisseEpargneTab,
  'banque-populaire': BanquePopulaireTab,
  wise: WiseTab,
  'bourse-direct': BourseDirectTab,
  degiro: DegiroTab,
  ibkr: IbkrTab,
  simplefin: SimplefinTab,
  amundi: AmundiTab,
  cmes: CmesTab,
  natixis: NatixisTab,
  cic: CicTab,
  lbp: LbpTab,
  bnp: BnpTab,
  fortuneo: FortuneoTab,
  amex: AmexTab,
  corum: CorumTab,
  sofidy: SofidyTab,
  actual: ActualBudgetTab,
  finary: FinaryTab,
  homebank: HomeBankTab,
  [VISIBILITY_VIEW.key]: AccountsVisibilityTab,
}

const DOT = 'size-1.5 shrink-0 rounded-full'

/** Where the provider stands: not connected, its one connection's state, or how many it holds. */
function ViewStatus({ viewKey }: { viewKey: string }) {
  const { t } = useTranslation()
  const [now] = useState(() => Date.now())
  const { connections, isLoading, trActive, revolutRemembered } = useSyncConnections()
  if (isLoading) return null
  const mine = connections.filter((c) => c.viewKey === viewKey)
  if (mine.length === 1) {
    return <SyncLine connection={mine[0]!} now={now} />
  }
  const toReconnect = mine.filter((c) => needsReconnect(c, trActive, revolutRemembered)).length
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className={cn(DOT, mine.length ? 'bg-gain' : 'bg-muted-foreground')} aria-hidden />
        {mine.length ? t('sync.all.connectionCount', { count: mine.length }) : t('sync.view.notConnected')}
      </span>
      {toReconnect > 0 && (
        <span className="inline-flex items-center gap-1.5 text-warning">
          <span aria-hidden>·</span>
          {t('sync.view.toReconnect', { count: toReconnect })}
        </span>
      )}
    </p>
  )
}

/**
 * One provider's page: a back link, a header (mark, name, what it syncs, where it stands)
 * and the provider's own panel as the body, about 760px wide. Panels render no page header
 * of their own; this frame is the contract they rely on.
 */
export function ProviderView({ viewKey, onBack }: { viewKey: string; onBack: () => void }) {
  const { t } = useTranslation()
  const entry = catalogEntry(viewKey)
  const isVisibility = viewKey === VISIBILITY_VIEW.key
  const Panel = (VIEW_PANELS as Record<string, ComponentType | undefined>)[viewKey]
  if (!Panel || (!entry && !isVisibility)) return null
  const name = t(entry?.labelKey ?? VISIBILITY_VIEW.labelKey)
  // File imports hold no connection; the visibility switches are not a provider at all.
  const hasStatus = entry !== undefined && (entry.category !== 'files' || entry.key === 'finary')

  return (
    <div className="max-w-[47.5rem] space-y-5">
      <Button variant="ghost" size="xs" className="-ml-3 px-3 text-muted-foreground" onClick={onBack}>
        <ArrowLeft />
        {t('sync.title')}
      </Button>
      <header className={cn('flex gap-4', entry ? 'items-start' : 'items-center')}>
        <ProviderMark size="lg" name={name} logo={entry?.logo} icon={entry ? entry.icon : VISIBILITY_VIEW.icon} />
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl leading-tight font-bold tracking-tight text-balance text-foreground">{name}</h1>
          {entry && <p className="text-sm text-muted-foreground">{t(entry.descKey)}</p>}
          {hasStatus && <ViewStatus viewKey={viewKey} />}
        </div>
      </header>
      <section aria-label={name}>
        <Panel />
      </section>
    </div>
  )
}
