import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import picsouLogo from '@/assets/horizontal-white-picsou.svg'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth-store'
import { useAppStore } from '@/stores/app-store'

export function ErrorScreen({ icon, code, title, message }: { icon: React.ReactNode; code: string; title: string; message: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // ErrorLayout keeps the app shell for a signed-in user; a visitor gets a bare page, so it carries the logo.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const demoMode = useAppStore((s) => s.demoMode)
  const bare = !isAuthenticated && !demoMode
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {bare && <img src={picsouLogo} alt="Picsou" className="mb-10 h-7 w-auto brightness-0 dark:invert" />}
        <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-6" aria-hidden="true">
          {icon}
        </span>
        <p className="text-[13px] font-medium text-muted-foreground tabular-nums">{t('error.code', { code })}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">{message}</p>
        <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft aria-hidden="true" />
            {t('common.back')}
          </Button>
          <Button asChild>
            <Link to="/">{t('error.backToDashboard')}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
