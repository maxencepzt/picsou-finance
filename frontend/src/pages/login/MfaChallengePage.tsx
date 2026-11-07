import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useVerifyMfa } from '@/features/mfa/hooks'
import { safeRedirect, isOAuthAuthorizeRedirect } from '@/lib/utils'
import { formatApiError, getErrorStatus } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { ArrowLeft, CircleAlert, Loader2, ShieldCheck } from 'lucide-react'
import { AuthScreen, CheckboxRow } from './AuthScreen'

const TOTP_LENGTH = 6

/**
 * Second step of the MFA login flow. Reached only after `/auth/login`
 * returned `mfaRequired:true`; relies on the mfa_challenge HttpOnly cookie
 * the server set on that response. No `from`-state validation here — the
 * server enforces the challenge cookie's existence and freshness.
 */
export function MfaChallengePage() {
  const { t } = useTranslation()
  const verify = useVerifyMfa()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const rememberMeFromUrl = searchParams.get('rememberMe') === '1'

  const [code, setCode] = useState('')
  const [isRecoveryCode, setIsRecoveryCode] = useState(false)
  // Trust-device checkbox: pre-checked iff the user ticked "Remember Me" on the
  // login form. Asking again here would be redundant, but they can opt out
  // before submitting the second factor.
  const [trustDevice, setTrustDevice] = useState(rememberMeFromUrl)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await verify.mutateAsync({ code, isRecoveryCode, trustDevice })
      // A /oauth2/ target (native app login) is server-handled — full-navigate to resume the
      // OAuth flow; any other target is an in-app SPA route.
      if (isOAuthAuthorizeRedirect(redirect)) window.location.assign(redirect)
      else navigate(redirect, { replace: true })
    } catch (err: unknown) {
      const status = getErrorStatus(err)
      const ax = err as { response?: unknown; message?: string }
      if (!ax.response) {
        setError(t('auth.networkError'))
      } else if (status === 401) {
        // Most likely the mfa_challenge cookie expired (default 5 minutes)
        // or the user lingered on this page. Send them back to /login.
        setError(t('auth.mfaSessionExpired'))
        setTimeout(() => navigate('/login', { replace: true }), 1500)
      } else if (status === 429) {
        setError(t('auth.mfaTooManyAttempts'))
      } else if (status === 400) {
        setError(t('auth.mfaInvalidCode'))
      } else {
        setError(formatApiError(err, t, 'auth.mfaGenericError'))
      }
    }
  }

  const codeInputId = 'mfa-code'
  const incomplete = isRecoveryCode ? code.length === 0 : code.length < TOTP_LENGTH

  return (
    <AuthScreen
      icon={<ShieldCheck />}
      title={t('auth.mfaTitle')}
      description={isRecoveryCode ? t('auth.mfaRecoveryDesc') : t('auth.mfaDesc')}
      footer={
        <Link to="/login" className="inline-flex min-h-10 items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('auth.backToLogin')}
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor={codeInputId}>
            {isRecoveryCode ? t('auth.mfaRecoveryLabel') : t('auth.mfaCodeLabel')}
          </Label>
          {isRecoveryCode ? (
            <Input
              id={codeInputId}
              type="text"
              maxLength={16}
              value={code}
              onChange={e => setCode(e.target.value)}
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              required
              aria-invalid={error ? true : undefined}
              className="font-mono tracking-wider"
            />
          ) : (
            <InputOTP
              id={codeInputId}
              maxLength={TOTP_LENGTH}
              pattern={REGEXP_ONLY_DIGITS}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={setCode}
              autoFocus
              required
              aria-invalid={error ? true : undefined}
              containerClassName="w-full"
            >
              <InputOTPGroup className="w-full">
                {Array.from({ length: TOTP_LENGTH }, (_, i) => (
                  <InputOTPSlot key={i} index={i} aria-invalid={error ? true : undefined} className="flex-1 text-base font-medium tabular-nums" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          )}
          <button
            type="button"
            onClick={() => {
              setIsRecoveryCode(v => !v)
              setCode('')
              setError(null)
            }}
            className="inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {isRecoveryCode ? t('auth.mfaUseTotp') : t('auth.mfaUseRecovery')}
          </button>
        </div>

        <CheckboxRow
          id="trustDevice"
          checked={trustDevice}
          onCheckedChange={setTrustDevice}
          label={t('auth.mfaTrustDevice')}
          description={t('auth.mfaTrustDeviceDesc')}
        />

        {error && (
          <AlertBanner role="alert" icon={<CircleAlert className="size-4 shrink-0" aria-hidden="true" />}>
            {error}
          </AlertBanner>
        )}

        <Button type="submit" disabled={verify.isPending || incomplete} className="w-full">
          {verify.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {verify.isPending ? t('auth.mfaVerifying') : t('auth.mfaVerifyButton')}
        </Button>
      </form>
    </AuthScreen>
  )
}
