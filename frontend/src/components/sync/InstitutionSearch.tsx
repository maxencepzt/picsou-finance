import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { BankCountrySelect, DEFAULT_BANK_COUNTRY } from '@/components/shared/BankCountrySelect'
import { PanelError, PanelLoading } from '@/components/sync/ProviderPanel'
import { ProviderMark } from '@/components/shared/ProviderMark'
import { Search } from 'lucide-react'
import { extractErrorMessage, formatApiError } from '@/lib/errors'
import { useSearchInstitutions } from '@/features/sync/hooks'

interface InstitutionSearchProps {
  onConnect: (institutionId: string, institutionName: string) => void
  connecting: boolean
  /** `page` is the Sync tab (labelled, card rows); `modal` is the compact, scrollable add-account list. */
  layout: 'page' | 'modal'
}

export function InstitutionSearch({ onConnect, connecting, layout }: InstitutionSearchProps) {
  const { t } = useTranslation()
  const modal = layout === 'modal'
  const [searchQuery, setSearchQuery] = useState('')
  const [country, setCountry] = useState(DEFAULT_BANK_COUNTRY)

  const {
    data: institutions,
    isError: searchFailed,
    isLoading: searchLoading,
    error: searchError } = useSearchInstitutions(searchQuery.trim(), country)

  const searchEnabled = searchQuery.trim().length >= 2

  function renderRow(inst: NonNullable<typeof institutions>[number]) {
    return (
      <div key={inst.id} className="flex items-center gap-3 px-1 py-2">
        <ProviderMark size="sm" name={inst.name} logo={inst.logoUrl} />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="min-w-0 text-sm font-medium text-foreground">{inst.name}</span>
          {inst.psuType === 'business' && (
            <span
              title={t('sync.banks.proBadgeTitle')}
              className="rounded-md bg-muted px-1.5 text-xs font-medium text-muted-foreground"
            >
              {t('sync.banks.proBadge')}
            </span>
          )}
        </div>
        <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{inst.country}</span>
        <Button
          size="xs"
          variant="outline"
          className="shrink-0 pointer-coarse:h-10"
          onClick={() => onConnect(inst.id, inst.name)}
          disabled={connecting}
        >
          {t('sync.banks.connect')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {!modal && <Label htmlFor="bank-search">{t('sync.banks.search')}</Label>}
        <div className="flex items-start gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            {/* 40px like the country select beside it: one row, one height. */}
            <Input
              id="bank-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sync.banks.searchPlaceholder')}
              aria-label={modal ? t('sync.banks.search') : undefined}
              className="pl-9"
              autoFocus={modal}
            />
          </div>
          <BankCountrySelect value={country} onChange={setCountry} />
        </div>
      </div>

      {searchLoading && <PanelLoading />}

      {searchEnabled && searchFailed && !searchLoading && (
        <PanelError>
          {modal
            ? extractErrorMessage(searchError, t('sync.banks.searchError'))
            : formatApiError(searchError, t, 'sync.banks.searchError')}
        </PanelError>
      )}

      {searchEnabled && !searchFailed && institutions && institutions.length > 0 && (
        modal ? (
          <div className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-xl px-2 ring-1 ring-foreground/10">
            {institutions.map(renderRow)}
          </div>
        ) : (
          <Card size="sm">
            <CardContent className="divide-y divide-border/60">{institutions.map(renderRow)}</CardContent>
          </Card>
        )
      )}

      {searchEnabled && !searchFailed && institutions && institutions.length === 0 && !searchLoading && (
        <p className="px-1 text-sm text-muted-foreground">{t('common.noResults')}</p>
      )}
    </div>
  )
}
