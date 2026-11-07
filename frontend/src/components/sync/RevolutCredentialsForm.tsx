import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup } from '@/components/ui/input-otp'
import { MaskedOTPSlot } from '@/components/sync/MaskedOTPSlot'
import { PanelField, PanelForm } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_INPUT } from '@/components/sync/panel-styles'
import { Loader2, Lock, Smartphone } from 'lucide-react'

export interface RevolutCredentials {
  phoneNumber: string
  passcode: string
  remember: boolean
}

interface RevolutCredentialsFormProps {
  value: RevolutCredentials
  onChange: (value: RevolutCredentials) => void
  onSubmit: (e: React.FormEvent) => void
  busy: boolean
  /** `page`: Sync page (a card, plain passcode input). `modal`: add-account wizard (no card, masked OTP passcode). */
  variant: 'page' | 'modal'
}

export function RevolutCredentialsForm({ value, onChange, onSubmit, busy, variant }: RevolutCredentialsFormProps) {
  const { t } = useTranslation()
  const modal = variant === 'modal'

  return (
    <PanelForm
      bare={modal}
      onSubmit={onSubmit}
      actions={
        <Button type="submit" size="xs" disabled={busy} className={PANEL_ACTION}>
          {busy && <Loader2 className="animate-spin" />}
          {busy ? t('sync.revolut.syncing') : t('sync.revolut.sync')}
        </Button>
      }
    >
      <PanelField id="revolut-phone" label={t('sync.revolut.phone')} icon={Smartphone}>
        <Input
          id="revolut-phone"
          className={PANEL_INPUT}
          type="tel"
          autoComplete="tel"
          value={value.phoneNumber}
          onChange={(e) => onChange({ ...value, phoneNumber: e.target.value })}
          required
          disabled={busy}
          placeholder="+33..."
          autoFocus={modal}
        />
      </PanelField>

      <PanelField id="revolut-passcode" label={t('sync.revolut.passcode')} icon={Lock}>
        {modal ? (
          <InputOTP
            id="revolut-passcode"
            maxLength={6}
            value={value.passcode}
            onChange={(passcode) => onChange({ ...value, passcode })}
            disabled={busy}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <MaskedOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        ) : (
          <Input
            id="revolut-passcode"
            className={PANEL_INPUT}
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={value.passcode}
            onChange={(e) => onChange({ ...value, passcode: e.target.value })}
            required
            disabled={busy}
          />
        )}
      </PanelField>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={value.remember}
          onCheckedChange={(checked) => onChange({ ...value, remember: checked === true })}
          disabled={busy}
        />
        {t('sync.revolut.remember')}
      </label>
    </PanelForm>
  )
}
