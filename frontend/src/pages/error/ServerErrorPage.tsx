import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ServerCrash } from 'lucide-react'
import { ErrorScreen } from './ErrorScreen'

export function ServerErrorPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  return (
    <ErrorScreen
      icon={<ServerCrash />}
      code={searchParams.get('code') || '500'}
      title={t('error.serverErrorTitle')}
      message={t('error.serverError')}
    />
  )
}
