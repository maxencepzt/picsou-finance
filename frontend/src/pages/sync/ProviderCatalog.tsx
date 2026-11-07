import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ScrollStrip } from '@/components/shared/ScrollStrip'
import { cn } from '@/lib/utils'
import { CATALOG, PROVIDER_CATEGORIES, filterCatalog, type CatalogProvider, type ProviderCategory } from './catalog'
import { ProviderMark } from '@/components/shared/ProviderMark'

const FILTERS = ['all', ...PROVIDER_CATEGORIES] as const

/**
 * The "Add a connection" catalog: a search, a category filter and the providers as logo
 * tiles. The same component serves the Sync page and the add-account modal, so both entry
 * points read and behave alike; the caller decides what choosing a provider opens.
 * Tiles flow on the catalog's own width (container queries), not the screen's: one column
 * on a phone, two in the modal, three on the page.
 */
export function ProviderCatalog({ onSelect, autoFocus }: {
  onSelect: (provider: CatalogProvider) => void
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<ProviderCategory | 'all'>('all')
  const matches = filterCatalog(CATALOG, query, category, t)
  const groups = PROVIDER_CATEGORIES
    .map((c) => ({ category: c, providers: matches.filter((p) => p.category === c) }))
    .filter((g) => g.providers.length > 0)

  return (
    <section aria-label={t('sync.catalog.title')} className="@container space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sync.catalog.searchPlaceholder')}
          aria-label={t('sync.catalog.search')}
          className="h-9 pl-9"
          autoFocus={autoFocus}
        />
      </div>

      <ScrollStrip activeKey={category}>
        <div role="group" aria-label={t('sync.catalog.categoriesLabel')} className="flex w-max gap-1 @xl:w-auto @xl:flex-wrap">
          {FILTERS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-[background-color,color] pointer-coarse:h-10',
                category === c ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {t(`sync.catalog.categories.${c}`)}
            </button>
          ))}
        </div>
      </ScrollStrip>

      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('sync.catalog.noMatch')}</p>
      ) : (
        <div className="space-y-4 pt-1">
          {groups.map((group) => (
            <section key={group.category} className="space-y-2">
              {category === 'all' && (
                <h3 className="text-xs font-semibold text-muted-foreground">{t(`sync.catalog.categories.${group.category}`)}</h3>
              )}
              <ul className="grid gap-2 @md:grid-cols-2 @3xl:grid-cols-3">
                {group.providers.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(p)}
                      className="flex h-full w-full items-center gap-3 rounded-xl p-3 text-left ring-1 ring-foreground/10 transition-colors hover:bg-muted/60"
                    >
                      <ProviderMark name={t(p.labelKey)} logo={p.logo} icon={p.icon} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-sm leading-snug font-semibold text-foreground">{t(p.labelKey)}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{t(p.descKey)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}
