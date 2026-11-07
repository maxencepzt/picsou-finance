import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { accountTypeLabelKey } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import type { Account } from '@/types/api'
import { maturity } from './investments'

/** How far each PEA and assurance vie is from the age that opens its tax advantage. */
export function TaxWrappersCard({ accounts, now }: { accounts: Account[]; now: Date }) {
  const { t } = useTranslation()
  const years = (count: number) => t('investments.tax.years', { count })

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{t('investments.tax.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-5">
          {accounts.map((account) => {
            const m = maturity(account, now)
            const kind = account.type === 'PEA' ? 'pea' : 'av'
            return (
              <li key={account.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate font-semibold">{account.name}</span>
                  {m
                    ? (
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {[m.years > 0 && years(m.years), (m.months > 0 || m.years === 0) && t('investments.tax.months', { count: m.months })].filter(Boolean).join(' ')}
                        {' / '}{years(m.thresholdYears)}
                      </span>
                    )
                    : <Badge variant="outline">{t(accountTypeLabelKey(account.type))}</Badge>}
                </div>
                {m
                  ? (
                    <>
                      <Progress value={m.progress} aria-label={t('investments.tax.ageOf', { name: account.name })} />
                      <span className="text-xs text-muted-foreground">
                        {t(`investments.tax.${kind}.${m.reached ? 'reached' : 'pending'}`, { date: formatDate(m.maturityDate) })}
                      </span>
                    </>
                  )
                  : (
                    <span className="text-xs text-muted-foreground">
                      {t('investments.tax.missing')}{' '}
                      {/* The opening date is edited from the accounts list; the detail page has no account form. */}
                      <Link to="/accounts" className="font-medium text-primary hover:text-foreground">
                        {t('investments.tax.setDate')}
                      </Link>
                    </span>
                  )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
