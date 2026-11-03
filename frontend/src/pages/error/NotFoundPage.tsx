import { useTranslation } from 'react-i18next'
import { FileQuestion } from 'lucide-react'
import { ErrorScreen } from './ErrorScreen'

export function NotFoundPage() {
  const { t } = useTranslation()
  return <ErrorScreen icon={<FileQuestion />} code="404" title={t('error.notFoundTitle')} message={t('error.notFound')} />
}
