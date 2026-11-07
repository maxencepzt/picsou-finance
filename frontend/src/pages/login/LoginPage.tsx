import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useLoginWithRememberMe } from '@/features/mfa/hooks'
import { ssoErrorMessage } from '@/features/sso/errors'
import { useSsoInfo } from '@/features/sso/hooks'
import { submitSsoStart } from '@/features/sso/start'
import { useAppStore } from '@/stores/app-store'
import { safeRedirect, isOAuthAuthorizeRedirect } from '@/lib/utils'
import { formatApiError, getErrorStatus } from '@/lib/errors'
import { consumeSsoRevalidate, rememberSsoPreference, ssoRememberPreference } from '@/lib/sso-revalidate'
import { Button } from '@/components/ui/button'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CircleAlert, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { AuthScreen, CheckboxRow } from './AuthScreen'
import { SsoProgressScreen } from './SsoProgressScreen'

export function LoginPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const ssoError = searchParams.get('ssoError')
    return ssoError ? ssoErrorMessage(t, ssoError) : null
  })
  const [ssoRedirecting, setSsoRedirecting] = useState(false)
  const loginMutation = useLoginWithRememberMe()
  const demoMode = useAppStore(s => s.demoMode)
  const navigate = useNavigate()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const ssoInfo = useSsoInfo(!demoMode)
  const sso = !demoMode && ssoInfo.data?.enabled ? ssoInfo.data : null
  const ssoSettled = ssoInfo.isSuccess || ssoInfo.isError
  const revalidationHandled = useRef(false)

  const startSso = (remember: boolean) => {
    setSsoRedirecting(true)
    submitSsoStart({ intent: 'login', redirect, rememberMe: remember })
  }

  const handleSsoClick = () => {
    rememberSsoPreference(rememberMe)
    startSso(rememberMe)
  }

  // After an SSO_REVALIDATE refusal, restart the IdP round trip without a click. The one-shot
  // flag is read only once the SSO info has answered; read earlier, it would be spent while
  // the provider is still unknown.
  const restartRevalidation = useEffectEvent(() => {
    if (consumeSsoRevalidate() && sso) startSso(ssoRememberPreference())
  })
  useEffect(() => {
    if (!ssoSettled || revalidationHandled.current) return
    revalidationHandled.current = true
    restartRevalidation()
  }, [ssoSettled])

  // Back from the IdP can restore this page from the back/forward cache, spinner included.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSsoRedirecting(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // A /oauth2/ target is the backend authorize endpoint (native app login) — hand off with a
  // full-page navigation so the server resumes the flow; everything else is an in-app SPA route.
  const finishLogin = (target: string) => {
    if (isOAuthAuthorizeRedirect(target)) window.location.assign(target)
    else navigate(target, { replace: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      const result = await loginMutation.mutateAsync({ username, password, rememberMe })
      if (result.mfaRequired) {
        // Branch off to /login/mfa — the mfa_challenge cookie is now set.
        // Forward both the post-MFA redirect target and the rememberMe flag
        // so the user's preference survives the second hop. (Server-side, the
        // remember_me claim was already encoded into the mfa_challenge JWT —
        // the URL param is purely UI state for the trust-device checkbox.)
        const params = new URLSearchParams()
        if (redirect && redirect !== '/') params.set('redirect', redirect)
        if (rememberMe) params.set('rememberMe', '1')
        const qs = params.toString()
        navigate(`/login/mfa${qs ? `?${qs}` : ''}`)
        return
      }
      finishLogin(redirect)
    } catch (err: unknown) {
      const status = getErrorStatus(err)
      const ax = err as { response?: unknown; message?: string }
      if (!ax.response) {
        setError(t('auth.networkError'))
      } else if (status === 401) {
        setError(t('auth.error'))
      } else {
        setError(formatApiError(err, t, 'auth.loginGenericError'))
      }
    }
  }

  if (ssoRedirecting) return <SsoProgressScreen message={t('auth.sso.redirecting')} />

  return (
    <AuthScreen
      title={t('auth.login')}
      description={t('auth.loginTagline')}
      footer={demoMode && (
        <p className="text-center">
          <span className="font-medium text-foreground">{t('auth.demoMode')}</span>
          {' · '}
          {t('auth.demoModeDesc')}
        </p>
      )}
    >
      {!demoMode && ssoInfo.isError && (
        <AlertBanner
          role="alert"
          className="mb-4"
          icon={<CircleAlert className="size-4 shrink-0" aria-hidden="true" />}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void ssoInfo.refetch()}>
              {t('common.retry')}
            </Button>
          }
        >
          {t('auth.sso.infoError')}
        </AlertBanner>
      )}
      {sso && (
        <>
          <Button type="button" variant="outline" onClick={handleSsoClick} className="h-auto min-h-10 w-full whitespace-normal">
            <KeyRound aria-hidden="true" />
            {t('auth.sso.button', { provider: sso.providerName })}
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden />
            {t('auth.sso.or')}
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
        </>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t('auth.username')}</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            aria-invalid={error ? true : undefined}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              aria-invalid={error ? true : undefined}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPw ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showPw}
            >
              {showPw ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <CheckboxRow
          id="rememberMe"
          checked={rememberMe}
          onCheckedChange={setRememberMe}
          label={t('auth.rememberMe')}
          description={t('auth.rememberMeDesc')}
        />

        {error && (
          <AlertBanner role="alert" icon={<CircleAlert className="size-4 shrink-0" aria-hidden="true" />}>
            {error}
          </AlertBanner>
        )}

        <Button type="submit" disabled={loginMutation.isPending} className="w-full">
          {loginMutation.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {loginMutation.isPending ? t('auth.loggingIn') : t('auth.loginButton')}
        </Button>
      </form>
    </AuthScreen>
  )
}
