import { useTranslation } from 'react-i18next'
import { useMoney } from '@/hooks/use-money'
import type { CeilingUsage } from '@/lib/ceiling'
import { formatPercent, localeFromLanguage } from '@/lib/utils'

/** "22 % du plafond (5 000 € / 22 950 €)": the ring's accessible name, and the row's tooltip. */
export function useCeilingLabel(usage: CeilingUsage): string {
  const { t, i18n } = useTranslation()
  const money = useMoney()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  return t('accounts.ceiling.ariaLabel', {
    pct: formatPercent(usage.pct, { fractionDigits: 0 }, locale),
    used: money.amount(usage.used),
    ceiling: money.amount(usage.ceiling),
  })
}
