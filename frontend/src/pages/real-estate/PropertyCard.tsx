import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { PropertyValuationChart } from '@/components/property/PropertyValuationChart'
import { usePropertyValuations } from '@/features/accounts/hooks'
import { formatLocalDate, formatNumber, formatPercent, localeFromLanguage } from '@/lib/utils'
import type { Account, RealEstatePropertyLine } from '@/types/api'
import { EMBEDDED_CARD, monthYear } from './real-estate'
import { Figure } from './Figure'

/** One property: where and what it is, what it cost, and what it is estimated at today. */
export function PropertyCard({ line, account }: { line: RealEstatePropertyLine; account?: Account }) {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  // Newest first, per the API. Shares its cache with the chart below.
  const { data: history = [] } = usePropertyValuations(line.accountId)
  const latest = history[0]
  const metadata = account?.realEstate

  const meta = [
    line.city,
    line.surfaceArea != null ? `${formatNumber(line.surfaceArea)} m²` : null,
    metadata?.purchaseDate ? t('realEstatePage.property.boughtIn', { date: monthYear(metadata.purchaseDate, locale) }) : null,
  ].filter(Boolean).join(' · ')

  const badge = line.valuationMode === 'MANUAL'
    ? t('property.valuation.manualMode')
    : line.lastConfidence ? t(`property.valuation.confidence.${line.lastConfidence}`) : null
  const value = latest?.estimatedValue ?? account?.currentBalanceEur

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link to={`/accounts/${line.accountId}`} className="hover:text-primary">{line.name}</Link>
        </CardTitle>
        {meta && <CardDescription>{meta}</CardDescription>}
        {badge && <CardAction><Badge variant="secondary">{badge}</Badge></CardAction>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {metadata && (
            <Figure label={t('realEstate.purchasePrice')}><CurrencyDisplay value={metadata.purchasePrice} /></Figure>
          )}
          {value != null && (
            <Figure label={t(latest ? 'property.valuation.estimate' : 'property.details.currentValue')} strong>
              <CurrencyDisplay value={value} />
            </Figure>
          )}
          {latest?.lowValue != null && latest.highValue != null && (
            <Figure label={t('realEstatePage.property.range')}>
              <CurrencyDisplay value={latest.lowValue} /> – <CurrencyDisplay value={latest.highValue} />
            </Figure>
          )}
          {latest?.pricePerSqm != null && (
            <Figure label={t('property.valuation.pricePerSqm')}><CurrencyDisplay value={latest.pricePerSqm} /></Figure>
          )}
          {latest && (
            <Figure label={t('realEstatePage.property.updated')}>{formatLocalDate(latest.valuedAt, locale)}</Figure>
          )}
        </dl>

        {line.sharePercent < 100 && (
          <p className="text-[13px] text-muted-foreground">
            {t('property.details.coOwnedNote', { percent: formatPercent(line.sharePercent) })}
          </p>
        )}

        {/* The chart hides itself under two estimates; skip its wrapper too. */}
        {history.length >= 2 && (
          <div className={EMBEDDED_CARD}>
            <PropertyValuationChart accountId={line.accountId} costBasis={metadata?.costBasis ?? line.costBasis} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
