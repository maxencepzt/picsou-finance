import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { PanelError, PanelField, PanelForm } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_CODE_INPUT, PANEL_INPUT } from '@/components/sync/panel-styles'
import { Loader2, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { useInitiateTrAuth, useCompleteTrAuth, useReconnectTrAuth } from '@/features/sync/hooks'
import { TrAppConfirmation } from '@/components/sync/TrAppConfirmation'
import { formatTrAuthError, isTrAttemptOverError, isTrInvalidSessionStateError } from '@/lib/errors'
import { TR_AUTHENTICATOR_CODE_LENGTH, TR_PIN_MAX_LENGTH, TR_VERIFICATION_CODE_LENGTH } from '@/lib/constants'
import type { TrAuthInitResponse } from '@/types/api'

/** `AWAITING_APP` has no form: `auth/complete` stays open until the member confirms in the app. */
type TrAuthState = 'IDLE' | 'AWAITING_APP' | 'AWAITING_TAN'

interface TradeRepublicLoginProps {
  /** Called once the login is confirmed (in the app or with the code). */
  onConnected?: () => void
  /** `page`: Sync page (a card, plain inputs). `modal`: add-account wizard / dialogs (no card). */
  variant: 'page' | 'modal'
  /**
   * Masked phone stored with an expired session. When set, the form asks for the PIN or password
   * only and reconnects through `auth/reconnect`; it falls back to the full form when the
   * backend has no phone to reuse or the member picks another number.
   */
  maskedPhone?: string | null
}

export function TradeRepublicLogin({ onConnected, variant, maskedPhone = null }: TradeRepublicLoginProps) {
  const { t } = useTranslation()
  const modal = variant === 'modal'
  const [authState, setAuthState] = useState<TrAuthState>('IDLE')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [tan, setTan] = useState('')
  const [processId, setProcessId] = useState<string | null>(null)
  const [codeLength, setCodeLength] = useState(TR_VERIFICATION_CODE_LENGTH)
  const [authenticator, setAuthenticator] = useState(false)
  const [reconnectDisabled, setReconnectDisabled] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const initiateMutation = useInitiateTrAuth()
  const reconnectMutation = useReconnectTrAuth()
  const completeMutation = useCompleteTrAuth()
  const reconnecting = maskedPhone !== null && !reconnectDisabled

  function finishLogin() {
    setTan('')
    setPhone('')
    setPin('')
    setProcessId(null)
    setErrorMsg(null)
    setAuthState('IDLE')
    onConnected?.()
  }

  function completeLogin(id: string, code?: string) {
    completeMutation.mutate(
      { processId: id, tan: code },
      {
        onSuccess: finishLogin,
        onError: (err: unknown) => {
          setErrorMsg(formatTrAuthError(err, t))
          setTan('')
          // A dead attempt (refused, timed out, ...) cannot be completed any more: start over.
          // A mistyped code leaves the attempt alive, so the code field stays.
          if (code === undefined || isTrAttemptOverError(err)) {
            setProcessId(null)
            setAuthState('IDLE')
            return
          }
          setAuthState('AWAITING_TAN')
        },
      },
    )
  }

  function startAuthStep(data: TrAuthInitResponse) {
    setProcessId(data.processId)
    setTan('')
    setErrorMsg(null)
    if (data.flow === 'confirmInApp') {
      // Nothing to type: hold the completion request open while the member confirms in the app.
      setCountdown(data.countdownInSeconds)
      setAuthState('AWAITING_APP')
      completeLogin(data.processId)
      return
    }
    const isAuthenticator = data.flow === 'authenticator'
    setAuthenticator(isAuthenticator)
    setCodeLength(isAuthenticator ? TR_AUTHENTICATOR_CODE_LENGTH : TR_VERIFICATION_CODE_LENGTH)
    setAuthState('AWAITING_TAN')
  }

  function handleInitiate(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length === 0) return
    const callbacks = {
      onSuccess: startAuthStep,
      onError: (err: unknown) => {
        if (reconnecting && isTrInvalidSessionStateError(err)) {
          // No phone stored server-side: ask for it with the full form.
          setReconnectDisabled(true)
          setPin('')
          setErrorMsg(null)
        } else {
          setErrorMsg(formatTrAuthError(err, t))
        }
        setProcessId(null)
        setTan('')
        setAuthState('IDLE')
      },
    }
    if (reconnecting) reconnectMutation.mutate({ pin }, callbacks)
    else initiateMutation.mutate({ phoneNumber: phone, pin }, callbacks)
  }

  function handleTan(e: React.FormEvent) {
    e.preventDefault()
    if (!processId || tan.length !== codeLength) return
    completeLogin(processId, tan)
  }

  // Only dismiss the banner: the mutations' onError handlers already reset
  // authState/processId appropriately per failure type. Resetting to IDLE here
  // would throw away a still-valid TAN session after a completion failure.
  function dismissError() {
    setErrorMsg(null)
  }

  const phoneField = reconnecting ? (
    <div className="space-y-1.5">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Smartphone className="size-3.5 text-muted-foreground" aria-hidden />
        {t('sync.tr.reconnectPhone')}
      </p>
      <p className="font-mono text-sm text-foreground" data-testid="tr-masked-phone">{maskedPhone}</p>
    </div>
  ) : (
    <PanelField id="tr-phone" label={t('sync.tr.phone')} icon={Smartphone}>
      <Input
        id="tr-phone"
        className={PANEL_INPUT}
        type="tel"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        placeholder="+49..."
        autoFocus={modal}
      />
    </PanelField>
  )

  // A plain password field in both variants: Trade Republic accepts a PIN or a password.
  const pinField = (
    <PanelField id="tr-pin" label={t('sync.tr.pin')} icon={Lock}>
      <Input
        id="tr-pin"
        className={PANEL_INPUT}
        type="password"
        autoComplete="current-password"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        maxLength={TR_PIN_MAX_LENGTH}
        required
        autoFocus={modal && reconnecting}
      />
    </PanelField>
  )

  const tanField = (
    <PanelField id="tr-tan" label={authenticator ? t('sync.tr.authenticatorCode') : t('sync.tr.tan')}>
      {modal ? (
        <InputOTP
          id="tr-tan"
          maxLength={codeLength}
          value={tan}
          onChange={(value) => setTan(value.replace(/\D/g, '').slice(0, codeLength))}
          autoFocus
        >
          <InputOTPGroup>
            {Array.from({ length: codeLength }, (_, i) => i).map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ) : (
        <Input
          id="tr-tan"
          className={PANEL_CODE_INPUT}
          value={tan}
          onChange={(e) => setTan(e.target.value.replace(/\D/g, '').slice(0, codeLength))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={codeLength}
          required
          autoFocus
        />
      )}
    </PanelField>
  )

  const awaitingTan = authState === 'AWAITING_TAN'
  const pending = awaitingTan
    ? completeMutation.isPending
    : initiateMutation.isPending || reconnectMutation.isPending

  const anotherNumber = !awaitingTan && reconnecting && (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={PANEL_ACTION}
      onClick={() => {
        setReconnectDisabled(true)
        setPin('')
        setErrorMsg(null)
      }}
    >
      {t('sync.tr.useAnotherNumber')}
    </Button>
  )

  return (
    <div className="space-y-4">
      {errorMsg && (
        <PanelError onRetry={dismissError} retryLabel={t('sync.banks.retry')}>
          {errorMsg}
        </PanelError>
      )}
      {authState === 'AWAITING_APP' ? (
        // Nothing to type: the completion request stays open while the member confirms in the app.
        modal ? (
          <TrAppConfirmation countdownInSeconds={countdown} />
        ) : (
          <Card size="sm">
            <CardContent>
              <TrAppConfirmation countdownInSeconds={countdown} />
            </CardContent>
          </Card>
        )
      ) : (
        <PanelForm
          // Remounts per step so the TAN field mounts fresh and takes the focus.
          key={awaitingTan ? 'tan' : 'initiate'}
          bare={modal}
          onSubmit={awaitingTan ? handleTan : handleInitiate}
          step={
            awaitingTan
              ? {
                  icon: ShieldCheck,
                  title: authenticator
                    ? t('sync.tr.authenticatorPrompt')
                    : t('sync.tr.tanPrompt', { length: codeLength }),
                }
              : undefined
          }
          actions={
            <>
              {anotherNumber}
              <Button
                type="submit"
                size="xs"
                className={PANEL_ACTION}
                disabled={pending || (awaitingTan && tan.length !== codeLength)}
              >
                {pending && <Loader2 className="animate-spin" />}
                {t('sync.tr.connect')}
              </Button>
            </>
          }
        >
          {awaitingTan ? tanField : <>{phoneField}{pinField}</>}
        </PanelForm>
      )}
    </div>
  )
}
