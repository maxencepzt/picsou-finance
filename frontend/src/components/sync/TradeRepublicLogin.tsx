import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { MaskedOTPSlot } from '@/components/sync/MaskedOTPSlot'
import { PanelError, PanelField, PanelForm } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_CODE_INPUT, PANEL_INPUT } from '@/components/sync/panel-styles'
import { Loader2, Lock, ShieldCheck, Smartphone } from 'lucide-react'
import { useInitiateTrAuth, useCompleteTrAuth } from '@/features/sync/hooks'
import { formatTrAuthError } from '@/lib/errors'
import { TR_VERIFICATION_CODE_LENGTH } from '@/lib/constants'

type TrAuthState = 'IDLE' | 'AWAITING_TAN'

interface TradeRepublicLoginProps {
  /** Called once the TAN is accepted. */
  onConnected?: () => void
  /** `page`: Sync page (a card, plain inputs). `modal`: add-account wizard (no card, masked OTP PIN). */
  variant: 'page' | 'modal'
}

export function TradeRepublicLogin({ onConnected, variant }: TradeRepublicLoginProps) {
  const { t } = useTranslation()
  const modal = variant === 'modal'
  const [authState, setAuthState] = useState<TrAuthState>('IDLE')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [tan, setTan] = useState('')
  const [processId, setProcessId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const initiateMutation = useInitiateTrAuth()
  const completeMutation = useCompleteTrAuth()

  function handleInitiate(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length === 0) return
    initiateMutation.mutate(
      { phoneNumber: phone, pin },
      {
        onSuccess: (data) => {
          setProcessId(data.processId)
          setTan('')
          setAuthState('AWAITING_TAN')
          setErrorMsg(null)
        },
        onError: (err: unknown) => {
          setErrorMsg(formatTrAuthError(err, t))
          setProcessId(null)
          setTan('')
          setAuthState('IDLE')
        },
      },
    )
  }

  function handleTan(e: React.FormEvent) {
    e.preventDefault()
    if (!processId || tan.length !== TR_VERIFICATION_CODE_LENGTH) return
    completeMutation.mutate(
      { processId, tan },
      {
        onSuccess: () => {
          setTan('')
          setPhone('')
          setPin('')
          setProcessId(null)
          setErrorMsg(null)
          setAuthState('IDLE')
          onConnected?.()
        },
        onError: (err: unknown) => {
          setErrorMsg(formatTrAuthError(err, t))
          setTan('')
          setAuthState('AWAITING_TAN')
        },
      },
    )
  }

  // Only dismiss the banner: the mutations' onError handlers already reset
  // authState/processId appropriately per failure type. Resetting to IDLE here
  // would throw away a still-valid TAN session after a completion failure.
  function dismissError() {
    setErrorMsg(null)
  }

  const phoneField = (
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

  // The modal keeps masked slots (a PIN pad feel); the page a plain password field.
  const pinField = (
    <PanelField id="tr-pin" label={t('sync.tr.pin')} icon={Lock}>
      {modal ? (
        <InputOTP id="tr-pin" maxLength={4} value={pin} onChange={setPin} autoFocus>
          <InputOTPGroup>
            {[0, 1, 2, 3].map((i) => (
              <MaskedOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ) : (
        <Input
          id="tr-pin"
          className={PANEL_INPUT}
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      )}
    </PanelField>
  )

  const tanField = (
    <PanelField id="tr-tan" label={t('sync.tr.tan')}>
      {modal ? (
        <InputOTP
          id="tr-tan"
          maxLength={TR_VERIFICATION_CODE_LENGTH}
          value={tan}
          onChange={(value) => setTan(value.replace(/\D/g, '').slice(0, TR_VERIFICATION_CODE_LENGTH))}
          autoFocus
        >
          <InputOTPGroup>
            {[0, 1, 2, 3].map((i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      ) : (
        <Input
          id="tr-tan"
          className={PANEL_CODE_INPUT}
          value={tan}
          onChange={(e) => setTan(e.target.value.replace(/\D/g, '').slice(0, TR_VERIFICATION_CODE_LENGTH))}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={TR_VERIFICATION_CODE_LENGTH}
          required
          autoFocus
        />
      )}
    </PanelField>
  )

  const awaitingTan = authState === 'AWAITING_TAN'
  const pending = awaitingTan ? completeMutation.isPending : initiateMutation.isPending

  return (
    <div className="space-y-4">
      {errorMsg && (
        <PanelError onRetry={dismissError} retryLabel={t('sync.banks.retry')}>
          {errorMsg}
        </PanelError>
      )}
      <PanelForm
        // Remounts per step so the TAN field mounts fresh and takes the focus.
        key={awaitingTan ? 'tan' : 'initiate'}
        bare={modal}
        onSubmit={awaitingTan ? handleTan : handleInitiate}
        step={
          awaitingTan
            ? { icon: ShieldCheck, title: t('sync.tr.tanPrompt', { length: TR_VERIFICATION_CODE_LENGTH }) }
            : undefined
        }
        actions={
          <Button
            type="submit"
            size="xs"
            className={PANEL_ACTION}
            disabled={pending || (awaitingTan && tan.length !== TR_VERIFICATION_CODE_LENGTH)}
          >
            {pending && <Loader2 className="animate-spin" />}
            {t('sync.tr.connect')}
          </Button>
        }
      >
        {awaitingTan ? tanField : <>{phoneField}{pinField}</>}
      </PanelForm>
    </div>
  )
}
