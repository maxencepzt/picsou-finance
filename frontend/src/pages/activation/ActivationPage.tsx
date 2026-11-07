import { useState } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, CircleAlert, KeyRound, Loader2 } from 'lucide-react'
import { authApi } from '@/features/auth/api'
import { ssoErrorMessage } from '@/features/sso/errors'
import { useSsoInfo } from '@/features/sso/hooks'
import { submitSsoStart } from '@/features/sso/start'
import { formatApiError, getErrorStatus } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { AuthScreen, CheckboxRow } from '@/pages/login/AuthScreen'

/** Which field an error belongs to, so it renders under that field. */
type ActivationError = { field: 'ack' | 'password' | 'confirm' | 'form'; message: string }

const MIN_PASSWORD = 8

export function ActivationPage() {
  const { t } = useTranslation()
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const ssoInfo = useSsoInfo()
  const sso = ssoInfo.data?.enabled ? ssoInfo.data : null
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<ActivationError | null>(() => {
    const ssoError = searchParams.get('ssoError')
    return ssoError ? { field: 'form', message: ssoErrorMessage(t, ssoError) } : null
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!acknowledged) {
      setError({ field: 'ack', message: t('auth.activation.errorAcknowledge') })
      return
    }
    if (password.length < MIN_PASSWORD) {
      setError({ field: 'password', message: t('auth.validation.passwordTooShort') })
      return
    }
    if (password !== confirmPassword) {
      setError({ field: 'confirm', message: t('auth.activation.errorMismatch') })
      return
    }
    if (!token) {
      setError({ field: 'form', message: t('auth.activation.errorInvalidLink') })
      return
    }

    setLoading(true)
    try {
      await authApi.activate(token, password, true)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err: unknown) {
      // An unknown token answers 401 and an expired one 400: a dead link, not an expired session.
      const status = getErrorStatus(err)
      setError({
        field: 'form',
        message: status === 400 || status === 401
          ? t('auth.activation.errorFailed')
          : formatApiError(err, t, 'auth.activation.errorFailed'),
      })
    } finally {
      setLoading(false)
    }
  }

  const loginLink = (
    <Link to="/login" className="inline-flex min-h-10 items-center font-medium text-foreground underline-offset-4 hover:underline">
      {t('auth.backToLogin')}
    </Link>
  )

  if (success) {
    return (
      <AuthScreen
        icon={<CheckCircle2 className="text-gain" />}
        title={t('auth.activation.successTitle')}
        description={t('auth.activation.successBody')}
        footer={loginLink}
      >
        <div className="flex justify-center" role="status">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={t('auth.activation.successBody')} />
        </div>
      </AuthScreen>
    )
  }

  const fieldError = (field: ActivationError['field']) => (error?.field === field ? error.message : null)

  return (
    <AuthScreen
      icon={<KeyRound />}
      title={t('auth.activation.title')}
      description={sso ? t('activation.subtitleSso', { provider: sso.providerName }) : t('auth.activation.subtitle')}
      footer={loginLink}
    >
      <div className="flex items-start gap-3 rounded-xl bg-warning/10 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">{t('auth.activation.noticeTitle')}</p>
          <p className="text-[13px] leading-5 text-muted-foreground">{t('auth.activation.noticeBody')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <CheckboxRow
            id="acknowledge"
            checked={acknowledged}
            onCheckedChange={setAcknowledged}
            label={t('auth.activation.acknowledge')}
            invalid={!!fieldError('ack')}
            describedBy={fieldError('ack') ? 'acknowledge-error' : undefined}
          />
          {fieldError('ack') && (
            <p id="acknowledge-error" className="pl-7 text-[13px] text-destructive">{fieldError('ack')}</p>
          )}
        </div>

        {ssoInfo.isError && (
          <AlertBanner
            role="alert"
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
            <Button
              type="button"
              variant="outline"
              disabled={!acknowledged}
              onClick={() => submitSsoStart({ intent: 'activate', token, ack: true })}
              className="h-auto min-h-10 w-full whitespace-normal"
            >
              <KeyRound aria-hidden="true" />
              {t('activation.ssoButton', { provider: sso.providerName })}
            </Button>
            <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
              <span className="h-px flex-1 bg-border" aria-hidden />
              {t('auth.sso.or')}
              <span className="h-px flex-1 bg-border" aria-hidden />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">{t('auth.password')}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            aria-invalid={fieldError('password') ? true : undefined}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className={fieldError('password') ? 'text-[13px] text-destructive' : 'text-[13px] text-muted-foreground'}>
            {fieldError('password') ?? t('auth.activation.passwordHint')}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('auth.activation.confirmPassword')}</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            required
            aria-invalid={fieldError('confirm') ? true : undefined}
            aria-describedby={fieldError('confirm') ? 'confirm-error' : undefined}
          />
          {fieldError('confirm') && (
            <p id="confirm-error" className="text-[13px] text-destructive">{fieldError('confirm')}</p>
          )}
        </div>

        {fieldError('form') && (
          <AlertBanner role="alert" icon={<CircleAlert className="size-4 shrink-0" aria-hidden="true" />}>
            {fieldError('form')}
          </AlertBanner>
        )}

        <Button type="submit" className="w-full" disabled={!acknowledged || loading}>
          {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
          {loading ? t('auth.activation.submitting') : t('auth.activation.submit')}
        </Button>
      </form>
    </AuthScreen>
  )
}
