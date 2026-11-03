import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMoney } from '@/hooks/use-money'
import { RefreshCw, ChevronDown, Info } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { useRefreshValuation } from '@/features/accounts/hooks'
import { formatApiError } from '@/lib/errors'
import { cn, formatDecimal, formatLocalDate, formatNumber, formatPercent, localeFromLanguage } from '@/lib/utils'
import type { PropertyValuation, RealEstateMetadata, ValuationConfidence } from '@/types/api'

interface PropertyValuationCardProps {
  accountId: number
  metadata: RealEstateMetadata
  currentValue: number
}

/** Status as a dot and a word, never a filled chip. */
const CONFIDENCE_DOT: Record<ValuationConfidence, string> = {
  HIGH: 'bg-gain',
  MEDIUM: 'bg-warning',
  LOW: 'bg-loss',
}

export function PropertyValuationCard({ accountId, metadata, currentValue }: PropertyValuationCardProps) {
  const money = useMoney()
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const refresh = useRefreshValuation()
  const [result, setResult] = useState<PropertyValuation | null>(null)
  const [showMethod, setShowMethod] = useState(false)

  const isManual = metadata.valuationMode === 'MANUAL'

  const onRefresh = () => {
    refresh.mutate(accountId, { onSuccess: setResult })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('property.valuation.title')}</CardTitle>
        <CardAction>
          <Button size="sm" variant="outline" className="h-8 px-3" onClick={onRefresh} disabled={refresh.isPending}>
            <RefreshCw className={cn('size-3.5', refresh.isPending && 'animate-spin')} />
            {t('property.valuation.refresh')}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Fact label={t('property.details.currentValue')} value={<CurrencyDisplay value={currentValue} />} />
          {metadata.lastValuedAt && (
            <Fact label={t('accounts.lastValuation')} value={formatLocalDate(metadata.lastValuedAt, locale)} />
          )}
        </dl>
        {isManual && (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
            {t('property.valuation.manualMode')}
          </p>
        )}

        {refresh.isError && (
          <p role="alert" className="text-sm text-destructive">
            {formatApiError(refresh.error, t, 'property.valuation.error')}
          </p>
        )}

        {result && result.status !== 'OK' && (
          <div role="alert" className="flex gap-2 rounded-xl bg-muted/50 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p>{t(`property.valuation.status.${result.status}`)}</p>
              {result.status === 'UNSUPPORTED_AREA' && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('property.valuation.status.UNSUPPORTED_AREA_hint')}
                </p>
              )}
            </div>
          </div>
        )}

        {result && result.status === 'OK' && (
          <div className="space-y-3 rounded-xl bg-muted/50 p-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[13px] font-medium text-muted-foreground">{t('property.valuation.estimate')}</span>
              <CurrencyDisplay value={result.estimatedValue ?? 0} className="text-lg font-semibold tabular-nums text-foreground" />
              {result.confidence && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span className={cn('size-1.5 shrink-0 rounded-full', CONFIDENCE_DOT[result.confidence])} aria-hidden />
                  {t(`property.valuation.confidence.${result.confidence}`)}
                </span>
              )}
            </div>

            {result.lowValue != null && result.highValue != null && (
              <p className="text-sm text-muted-foreground">
                {t('property.valuation.range')}{' '}
                <CurrencyDisplay value={result.lowValue} className="tabular-nums" />
                {' – '}
                <CurrencyDisplay value={result.highValue} className="tabular-nums" />
              </p>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              {result.pricePerSqm != null && (
                <Fact label={t('property.valuation.pricePerSqm')}
                      value={`${money.amount(Math.round(result.pricePerSqm))}/m²`} />
              )}
              {result.sampleSize != null && (
                <Fact label={t('property.valuation.sampleSize')}
                      value={formatNumber(result.sampleSize, locale)} />
              )}
              {result.sourceYear != null && (
                <Fact label={t('property.valuation.sourceYear')} value={String(result.sourceYear)} />
              )}
              {result.scale && (
                <Fact label={t('property.valuation.scale')}
                      value={t(`property.valuation.scaleValue.${result.scale}`)} />
              )}
            </dl>

            {isManual && (
              <p className="text-xs text-muted-foreground">
                {t('property.valuation.manualNotApplied')}
              </p>
            )}

            {result.adjustments.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowMethod(v => !v)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                  aria-expanded={showMethod}
                >
                  <ChevronDown className={`size-4 transition-transform ${showMethod ? 'rotate-180' : ''}`} />
                  {t('property.valuation.method')}
                </button>

                {showMethod && (
                  <div className="mt-2 space-y-2 rounded-xl border p-3">
                    {/* Stated plainly: these coefficients encode market intuition, not a
                        model fitted on the open data, which records none of these features. */}
                    <p className="text-xs text-muted-foreground">
                      {t('property.valuation.methodDisclaimer')}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {result.adjustments.map(adj => (
                        <li key={adj.code} className="flex items-center justify-between gap-2">
                          <span>{t(`property.adjustments.${adj.code}`, { defaultValue: adj.code })}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {adj.factor != null
                              ? formatPercent(adj.factor * 100, { signed: true }, locale)
                              : adj.sqm != null
                                ? `+${adj.sqm} m²`
                                : ''}
                          </span>
                        </li>
                      ))}
                      {result.reindexRatio != null && (
                        <li className="flex items-center justify-between gap-2 border-t pt-1">
                          <span>{t('property.valuation.reindexed')}</span>
                          <span className="tabular-nums text-muted-foreground">
                            ×{formatDecimal(result.reindexRatio, 3, locale)}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
