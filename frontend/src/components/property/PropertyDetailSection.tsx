import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PropertyMetadataForm } from './PropertyMetadataForm'
import { PropertyValuationCard } from './PropertyValuationCard'
import { PropertyFinancingCard } from './PropertyFinancingCard'
import { OwnershipEditor } from './OwnershipEditor'
import { useRealEstateSummary } from '@/features/accounts/hooks'
import { formatPercent } from '@/lib/utils'
import type { Account } from '@/types/api'

interface PropertyDetailSectionProps {
  account: Account
}

/**
 * Everything specific to a property, mounted from the account detail page.
 *
 * <p>Mirrors the shape of the loan slice: a set of focused cards rather than one page-level
 * component, so each can be read and changed on its own. The value, the gain since purchase and
 * the valuation chart sit in the page's hero row, so they are not repeated here.
 */
export function PropertyDetailSection({ account }: PropertyDetailSectionProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const { data: summary } = useRealEstateSummary()

  const metadata = account.realEstate
  const line = summary?.properties.find(p => p.accountId === account.id)

  // sharePercent is only sent when the member owns less than all of it, so its presence is
  // exactly the "someone else has a say here" signal. Ownership is a separate question:
  // a co-owner reads the property but may not edit it, so write actions key off isOwner.
  const isCoOwned = account.sharePercent != null
  const isOwner = account.isOwner !== false

  if (!metadata && !isOwner) {
    // A co-owner landing on a property whose owner has not filled in the details yet has
    // nothing to see and nothing they are allowed to do about it.
    return null
  }

  if (!metadata || editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {metadata ? t('property.form.editTitle') : t('property.form.createTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!metadata && (
            <p className="mb-4 text-sm text-muted-foreground">{t('property.form.intro')}</p>
          )}
          {/* Keyed on the metadata identity so reopening the form remounts it with fresh
              defaults, rather than syncing state in an effect. */}
          <PropertyMetadataForm
            key={metadata ? `edit-${account.id}` : `create-${account.id}`}
            accountId={account.id}
            metadata={metadata}
            onSaved={() => setEditing(false)}
          />
          {metadata && (
            <div className="mt-3 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('property.details.title')}</CardTitle>
          {isOwner && (
            <CardAction>
              <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
                {t('common.edit')}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {metadata.propertyType && (
              <Fact label={t('property.form.propertyType')}
                    value={t(`property.kind.${metadata.propertyType}`, { defaultValue: metadata.propertyType })} />
            )}
            {metadata.category && (
              <Fact label={t('property.form.category')} value={t(`property.category.${metadata.category}`)} />
            )}
            {metadata.surfaceArea != null && (
              <Fact label={t('property.form.surfaceArea')} value={`${metadata.surfaceArea} m²`} />
            )}
            {metadata.rooms != null && (
              <Fact label={t('property.form.rooms')} value={String(metadata.rooms)} />
            )}
            {metadata.constructionYear != null && (
              <Fact label={t('property.form.constructionYear')} value={String(metadata.constructionYear)} />
            )}
            {metadata.energyClass && (
              <Fact label={t('property.form.energyClass')} value={metadata.energyClass} />
            )}
          </dl>

          {metadata.address && (
            <p className="border-t pt-3 text-[13px] text-muted-foreground">
              {[metadata.address, metadata.postalCode, metadata.city].filter(Boolean).join(', ')}
            </p>
          )}

          {isCoOwned && (
            <p className="text-xs text-muted-foreground">
              {t('property.details.coOwnedNote', { percent: formatPercent(Number(account.sharePercent)) })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Re-valuing writes the account balance, so it is an owner-only action. */}
      {isOwner && (
        <PropertyValuationCard
          accountId={account.id}
          metadata={metadata}
          currentValue={account.currentBalanceEur}
        />
      )}

      {line && <PropertyFinancingCard line={line} />}

      <OwnershipEditor accountId={account.id} canEdit={isOwner} />
    </div>
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
