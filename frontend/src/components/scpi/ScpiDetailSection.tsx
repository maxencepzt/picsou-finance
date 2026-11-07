import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Pencil, TriangleAlert } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NumericInput } from '@/components/shared/NumericInput'
import { DateInput } from '@/components/shared/DateInput'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useIgnoreScpiFund, useUpdateScpiPosition } from '@/features/accounts/hooks'
import { formatApiError } from '@/lib/errors'
import { formatLocalDate, parseAmount } from '@/lib/utils'
import type { Account, DistributionFrequency, DividendPolicy, ScpiPositionRequest, ScpiProvider } from '@/types/api'

const selectControlClassName =
  'flex h-10 w-full rounded-md border border-input bg-background text-foreground px-4 text-sm outline-none [color-scheme:light] dark:[color-scheme:dark]'

const num = (v: string): number | undefined => (v.trim() === '' ? undefined : parseAmount(v))

function distributionFrequencyKey(frequency: DistributionFrequency | null | undefined): string {
  if (frequency === 'MONTHLY') return 'scpi.frequencyMonthly'
  if (frequency === 'QUARTERLY') return 'scpi.frequencyQuarterly'
  return 'scpi.frequencyNone'
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-foreground">{children}</dd>
    </div>
  )
}

/**
 * The share, the two prices, and nothing that belongs to a house.
 * The balance shown above this card is the withdrawal value, never the subscription price.
 * The share count, the prices and the distribution sit in the page's hero, so the read view here
 * keeps what qualifies them: dividend policy, schedule, identifiers and the provider links.
 */
export function ScpiDetailSection({ account }: { account: Account }) {
  const { t } = useTranslation()
  const updatePosition = useUpdateScpiPosition()
  const ignoreFund = useIgnoreScpiFund()
  const [fundToIgnore, setFundToIgnore] = useState<{ provider: ScpiProvider; fundCode: string } | null>(null)
  const position = account.scpi
  const canEdit = account.isOwner !== false
  const [editing, setEditing] = useState(canEdit && !position)
  const [shareCount, setShareCount] = useState(position?.shareCount?.toString() ?? '')
  const [subscriptionPrice, setSubscriptionPrice] = useState(position?.subscriptionPriceEur?.toString() ?? '')
  const [withdrawalPrice, setWithdrawalPrice] = useState(position?.withdrawalPriceEur?.toString() ?? '')
  const [dividendPolicy, setDividendPolicy] = useState<DividendPolicy>(position?.dividendPolicy ?? 'CASH')
  const [annualDistribution, setAnnualDistribution] = useState(position?.annualDistributionPerShareEur?.toString() ?? '')
  const [distributionFrequency, setDistributionFrequency] = useState<DistributionFrequency | ''>(position?.distributionFrequency ?? '')
  const [jouissanceDate, setJouissanceDate] = useState(position?.jouissanceDate ?? '')
  const [isin, setIsin] = useState(position?.isin ?? '')
  const [managementCompany, setManagementCompany] = useState(position?.managementCompany ?? '')
  const [corumFundCode, setCorumFundCode] = useState(position?.corumFundCode ?? '')
  const [sofidyFundCode, setSofidyFundCode] = useState(position?.sofidyFundCode ?? '')

  function startEditing() {
    setShareCount(position?.shareCount?.toString() ?? '')
    setSubscriptionPrice(position?.subscriptionPriceEur?.toString() ?? '')
    setWithdrawalPrice(position?.withdrawalPriceEur?.toString() ?? '')
    setDividendPolicy(position?.dividendPolicy ?? 'CASH')
    setAnnualDistribution(position?.annualDistributionPerShareEur?.toString() ?? '')
    setDistributionFrequency(position?.distributionFrequency ?? '')
    setJouissanceDate(position?.jouissanceDate ?? '')
    setIsin(position?.isin ?? '')
    setManagementCompany(position?.managementCompany ?? '')
    setCorumFundCode(position?.corumFundCode ?? '')
    setSofidyFundCode(position?.sofidyFundCode ?? '')
    setEditing(true)
  }

  const shares = num(shareCount)
  const distribution = num(annualDistribution)
  // Both set, or both empty. One without the other is a silent no-forecast.
  const amountSet = distribution != null
  const frequencySet = distributionFrequency !== ''
  const distributionPairOk = amountSet === frequencySet && (distribution == null || distribution >= 0)
  const canSave = shares != null && shares >= 0 && distributionPairOk

  async function save() {
    if (!canEdit || !canSave || shares == null) return
    const data: ScpiPositionRequest = {
      isin: isin.trim() || null,
      managementCompany: managementCompany.trim() || null,
      corumFundCode: corumFundCode.trim(),
      sofidyFundCode: sofidyFundCode.trim(),
      shareCount: shares,
      subscriptionPriceEur: num(subscriptionPrice) ?? null,
      withdrawalPriceEur: num(withdrawalPrice) ?? null,
      dividendPolicy,
      jouissanceDate: jouissanceDate || null,
      annualDistributionPerShareEur: distribution != null && distribution >= 0 ? distribution : null,
      distributionFrequency: distributionFrequency || null,
    }
    await updatePosition.mutateAsync({ id: account.id, data })
    setEditing(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('scpi.position')}</CardTitle>
        {canEdit && position && !editing && (
          <CardAction>
            <Button size="sm" variant="outline" className="h-8 px-3" onClick={startEditing}>
              <Pencil className="size-3.5" />
              {t('scpi.edit')}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {position?.valuationStatus === 'PRICE_INCOMPLETE' && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t('scpi.incomplete')}
          </p>
        )}

        {position && (!editing || !canEdit) && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Fact label={t('scpi.dividendPolicy')}>
              {t(position.dividendPolicy === 'REINVEST' ? 'scpi.reinvest' : 'scpi.cash')}
            </Fact>
            <Fact label={t('scpi.distributionFrequency')}>
              {t(distributionFrequencyKey(position.distributionFrequency))}
            </Fact>
            {position.jouissanceDate && (
              <Fact label={t('scpi.jouissanceDate')}>{formatLocalDate(position.jouissanceDate)}</Fact>
            )}
            {position.managementCompany && (
              <Fact label={t('scpi.managementCompany')}><span className="block truncate">{position.managementCompany}</span></Fact>
            )}
            {position.isin && <Fact label={t('scpi.isin')}><span className="tabular-nums">{position.isin}</span></Fact>}
            {([
              ['CORUM', 'scpi.corumFundCode', position.corumFundCode],
              ['SOFIDY', 'scpi.sofidyFundCode', position.sofidyFundCode],
            ] as const).map(([provider, label, code]) => (
              <Fact key={provider} label={t(label)}>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{code || '—'}</span>
                  {code && canEdit && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs font-medium text-muted-foreground"
                      disabled={ignoreFund.isPending}
                      onClick={() => setFundToIgnore({ provider, fundCode: code })}
                    >
                      {t('scpi.ignoreFund')}
                    </Button>
                  )}
                </span>
              </Fact>
            ))}
          </dl>
        )}

        {canEdit && editing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-company">{t('scpi.managementCompany')}</Label>
                <Input id="scpi-edit-company" value={managementCompany} onChange={(e) => setManagementCompany(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-isin">{t('scpi.isin')}</Label>
                <Input id="scpi-edit-isin" value={isin} maxLength={12} onChange={(e) => setIsin(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-shares">{t('scpi.shareCount')}</Label>
                <NumericInput id="scpi-edit-shares" value={shareCount} onChange={(e) => setShareCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-withdrawal">{t('scpi.withdrawalPrice')}</Label>
                <NumericInput id="scpi-edit-withdrawal" value={withdrawalPrice} onChange={(e) => setWithdrawalPrice(e.target.value)} />
              </div>
            </div>
            <details className="space-y-4 rounded-xl border p-3">
            <summary className="cursor-pointer text-sm text-muted-foreground">{t('scpi.advancedLinks')}</summary>
            <div className="space-y-2">
              <Label htmlFor="scpi-edit-corum-fund">{t('scpi.corumFundCode')}</Label>
              <Input id="scpi-edit-corum-fund" value={corumFundCode} maxLength={40} onChange={(e) => setCorumFundCode(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('scpi.corumFundHint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scpi-edit-sofidy-fund">{t('scpi.sofidyFundCode')}</Label>
              <Input id="scpi-edit-sofidy-fund" value={sofidyFundCode} maxLength={40} onChange={(e) => setSofidyFundCode(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('scpi.sofidyFundHint')}</p>
            </div>
            </details>
            <div className="space-y-2">
              <Label htmlFor="scpi-edit-subscription">{t('scpi.subscriptionPrice')}</Label>
              <NumericInput id="scpi-edit-subscription" value={subscriptionPrice} onChange={(e) => setSubscriptionPrice(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('scpi.subscriptionHint')}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-dividend">{t('scpi.dividendPolicy')}</Label>
                <select
                  id="scpi-edit-dividend"
                  className={selectControlClassName}
                  value={dividendPolicy}
                  onChange={(e) => setDividendPolicy(e.target.value as DividendPolicy)}
                >
                  <option value="CASH">{t('scpi.cash')}</option>
                  <option value="REINVEST">{t('scpi.reinvest')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-jouissance">{t('scpi.jouissanceDate')}</Label>
                <DateInput id="scpi-edit-jouissance" value={jouissanceDate} onChange={setJouissanceDate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-annual-distribution">{t('scpi.annualDistribution')}</Label>
                <NumericInput
                  id="scpi-edit-annual-distribution"
                  value={annualDistribution}
                  onChange={(e) => setAnnualDistribution(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scpi-edit-distribution-frequency">{t('scpi.distributionFrequency')}</Label>
                <select
                  id="scpi-edit-distribution-frequency"
                  className={selectControlClassName}
                  value={distributionFrequency}
                  onChange={(e) => setDistributionFrequency(e.target.value as DistributionFrequency | '')}
                >
                  <option value="">{t('scpi.frequencyNone')}</option>
                  <option value="MONTHLY">{t('scpi.frequencyMonthly')}</option>
                  <option value="QUARTERLY">{t('scpi.frequencyQuarterly')}</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('scpi.annualDistributionHint')}</p>
            {updatePosition.error && (
              <p className="text-sm text-destructive">{formatApiError(updatePosition.error, t, 'common.error')}</p>
            )}
            <div className="flex justify-end gap-2">
              {position && (
                <Button type="button" variant="outline" className="h-9 px-4" onClick={() => setEditing(false)}>
                  {t('common.cancel')}
                </Button>
              )}
              <Button type="button" className="h-9 px-4" onClick={save} disabled={!canSave || updatePosition.isPending}>
                {t('scpi.save')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={fundToIgnore != null}
        onOpenChange={(open) => { if (!open) setFundToIgnore(null) }}
        title={t('scpi.ignoreFund')}
        description={t('scpi.ignoreFundConfirm')}
        confirmLabel={t('scpi.ignoreFund')}
        loading={ignoreFund.isPending}
        error={ignoreFund.error ? formatApiError(ignoreFund.error, t, 'common.error') : undefined}
        onConfirm={() => {
          if (!fundToIgnore) return
          ignoreFund.mutate(fundToIgnore, { onSuccess: () => setFundToIgnore(null) })
        }}
      />
    </Card>
  )
}
