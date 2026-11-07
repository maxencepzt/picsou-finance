import { useTranslation } from 'react-i18next'
import { ShieldX } from 'lucide-react'
import { ErrorScreen } from './ErrorScreen'

export function ForbiddenPage() {
  const { t } = useTranslation()
  return <ErrorScreen icon={<ShieldX />} code="403" title={t('error.forbiddenTitle')} message={t('error.forbidden')} />
}
