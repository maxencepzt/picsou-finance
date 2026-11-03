import { ArrowLeftRight, Eye, FileSpreadsheet, Landmark, type LucideIcon } from 'lucide-react'
import { logoKeyUrl, providerLogoUrl } from '@/lib/provider-logos'
import { normalizeSearch } from '@/lib/utils'

/** The families the "Add a connection" catalog filters on, in display order. */
export const PROVIDER_CATEGORIES = ['banks', 'brokers', 'crypto', 'savings', 'scpi', 'files'] as const
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number]

export interface CatalogProvider {
  /**
   * The `?tab=` key of the provider's view on /sync. Never rename one: the Sync-all modal,
   * the bank OAuth callback, `?reconnect=1` and the e2e specs all link to these keys.
   */
  key: string
  labelKey: string
  descKey: string
  category: ProviderCategory
  /** A bundled brand logo; a brand without one falls back to its monogram. */
  logo?: string | null
  /** A generic entry (any bank, any exchange) shows an icon rather than a brand. */
  icon?: LucideIcon
}

export const CATALOG = [
  { key: 'banks', labelKey: 'sync.banks.title', descKey: 'addAccount.desc.banks', category: 'banks', icon: Landmark },
  { key: 'bourso', labelKey: 'sync.bourso.title', descKey: 'addAccount.desc.bourso', category: 'banks', logo: providerLogoUrl('BoursoBank') },
  { key: 'caisse-epargne', labelKey: 'sync.caisseEpargne.title', descKey: 'addAccount.desc.caisseEpargne', category: 'banks' },
  { key: 'cic', labelKey: 'sync.cic.title', descKey: 'addAccount.desc.cic', category: 'banks' },
  { key: 'fortuneo', labelKey: 'sync.fortuneo.title', descKey: 'addAccount.desc.fortuneo', category: 'banks' },
  { key: 'revolut', labelKey: 'sync.revolut.title', descKey: 'addAccount.desc.revolut', category: 'banks' },
  { key: 'amex', labelKey: 'sync.amex.title', descKey: 'addAccount.desc.amex', category: 'banks' },
  { key: 'simplefin', labelKey: 'sync.simplefin.title', descKey: 'addAccount.desc.simplefin', category: 'banks' },
  { key: 'tr', labelKey: 'sync.tr.title', descKey: 'addAccount.desc.tr', category: 'brokers', logo: providerLogoUrl('Trade Republic') },
  { key: 'bourse-direct', labelKey: 'sync.bourseDirect.title', descKey: 'addAccount.desc.bourseDirect', category: 'brokers' },
  { key: 'degiro', labelKey: 'sync.degiro.title', descKey: 'addAccount.desc.degiro', category: 'brokers' },
  { key: 'ibkr', labelKey: 'sync.ibkr.title', descKey: 'addAccount.desc.ibkr', category: 'brokers' },
  { key: 'exchanges', labelKey: 'sync.exchanges.title', descKey: 'addAccount.desc.exchanges', category: 'crypto', icon: ArrowLeftRight },
  { key: 'wallets', labelKey: 'sync.wallets.title', descKey: 'addAccount.desc.wallets', category: 'crypto', logo: logoKeyUrl('blockchain') },
  { key: 'amundi', labelKey: 'sync.amundi.title', descKey: 'addAccount.desc.amundi', category: 'savings', logo: providerLogoUrl('Amundi Épargne Salariale') },
  { key: 'cmes', labelKey: 'sync.cmes.title', descKey: 'addAccount.desc.cmes', category: 'savings' },
  { key: 'corum', labelKey: 'sync.corum.title', descKey: 'addAccount.desc.corum', category: 'scpi' },
  { key: 'sofidy', labelKey: 'sync.sofidy.title', descKey: 'addAccount.desc.sofidy', category: 'scpi' },
  { key: 'finary', labelKey: 'sync.finary.title', descKey: 'addAccount.desc.finary', category: 'files' },
  { key: 'actual', labelKey: 'sync.actual.title', descKey: 'addAccount.desc.actual', category: 'files', icon: FileSpreadsheet },
  { key: 'homebank', labelKey: 'sync.homebank.title', descKey: 'addAccount.desc.homebank', category: 'files', icon: FileSpreadsheet },
] as const satisfies readonly CatalogProvider[]

/** Not a provider: the account-visibility switches, reached from the page header. */
export const VISIBILITY_VIEW = { key: 'visibility', labelKey: 'sync.visibility.title', icon: Eye } as const

/** Every `?tab=` key /sync answers to. */
export type ViewKey = (typeof CATALOG)[number]['key'] | typeof VISIBILITY_VIEW.key

export function isViewKey(key: string | null | undefined): key is ViewKey {
  return key === VISIBILITY_VIEW.key || catalogEntry(key) !== undefined
}

export function catalogEntry(key: string | null | undefined): CatalogProvider | undefined {
  return (CATALOG as readonly CatalogProvider[]).find((p) => p.key === key)
}

/**
 * The providers matching a search and a category, in catalog order. The search runs on the
 * translated name and description, accent- and case-insensitive.
 */
export function filterCatalog(
  providers: readonly CatalogProvider[],
  query: string,
  category: ProviderCategory | 'all',
  t: (key: string) => string,
): CatalogProvider[] {
  const needle = normalizeSearch(query)
  return providers.filter((p) =>
    (category === 'all' || p.category === category)
    && (!needle || normalizeSearch(`${t(p.labelKey)} ${t(p.descKey)}`).includes(needle)))
}
