import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorStatus, getErrorDetail } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  PanelDisconnect,
  PanelError,
  PanelField,
  PanelForm,
  PanelLoading,
  PanelStatus,
} from '@/components/sync/ProviderPanel'
import { PANEL_ACTION, PANEL_CODE_INPUT, PANEL_INPUT } from '@/components/sync/panel-styles'
import { formatTimeAgo } from '@/lib/utils'
import {
  FinaryMappingStep,
  FinaryResultStep,
  FinaryStepIndicator,
  FinaryUploadZone,
} from '@/components/sync/FinaryImportSteps'
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  useFinaryConnectionStatus,
  useFinaryLogin,
  useFinaryDeleteSession,
  useFinaryAutoSync,
} from '@/features/sync/hooks'
import { useFinaryImport } from '@/features/sync/use-finary-import'
import type { FinaryAutoSyncResponse } from '@/types/api'

export function FinaryTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: connectionStatus, isLoading: statusLoading } = useFinaryConnectionStatus()
  const loginMutation = useFinaryLogin()
  const deleteMutation = useFinaryDeleteSession()
  const autoSyncMutation = useFinaryAutoSync()

  const isConnected = connectionStatus?.connected ?? false
  const isTotpRequired = connectionStatus?.status === 'TOTP_REQUIRED'

  const wizard = useFinaryImport({
    errorMessage: getFinaryError,
    onImported: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
  const { step, previewData, mappings, importResult, loading, error, totpRequired, totpCode } = wizard

  // Login form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ----- Login -----

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    wizard.setLoading(true)
    wizard.setError(null)
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => {
          wizard.setLoading(false)
          setEmail('')
          setPassword('')
          // Now trigger preview with stored credentials
          wizard.previewApiSync()
        },
        onError: () => wizard.setLoading(false),
      },
    )
  }

  // ----- Auto-sync (primary path when connected) -----

  function handleAutoSync() {
    wizard.setLoading(true)
    wizard.setError(null)
    autoSyncMutation.mutate(undefined, {
      onSuccess: (data: FinaryAutoSyncResponse) => {
        wizard.setLoading(false)
        if (data.status === 'OK') {
          toast.success(t('sync.finary.accountsSyncedToast', { count: data.accountsSynced }))
        } else if (data.status === 'NEEDS_MAPPING') {
          wizard.previewApiSync()
        } else if (data.status === 'TOTP_REQUIRED') {
          wizard.setTotpRequired(true)
        } else {
          wizard.setError(t('sync.finary.notConnected'))
        }
      },
      onError: (err: unknown) => {
        wizard.setLoading(false)
        wizard.setError(getFinaryError(err))
      },
    })
  }

  function handleDelete() {
    deleteMutation.mutate()
  }

  function getFinaryError(err: unknown): string {
    const status = getErrorStatus(err)
    if (status === 502) return t('sync.finary.serviceUnavailable')
    const detail = getErrorDetail(err)
    if (detail) return detail
    return t('sync.finary.syncFailed')
  }

  // ----- Render -----

  if (statusLoading) return <PanelLoading />

  const lastSync = connectionStatus?.lastSyncedAt

  return (
    <div className="space-y-4">
      {isConnected && connectionStatus && step === 1 && (
        <PanelStatus
          tone={loading ? 'busy' : isTotpRequired ? 'warning' : 'ok'}
          // The 2FA form below names the missing code; the status keeps to the connection.
          label={t('sync.finary.connected')}
          meta={[
            connectionStatus.maskedEmail,
            lastSync ? t('sync.panel.lastSync', { time: formatTimeAgo(lastSync) }) : t('sync.finary.neverSynced'),
          ]}
          actions={
            <>
              <PanelDisconnect
                label={t('sync.finary.deleteConnection')}
                provider={t('sync.finary.title')}
                description={t('sync.finary.deleteConnectionConfirm')}
                confirmLabel={t('common.delete')}
                pending={deleteMutation.isPending}
                onConfirm={handleDelete}
              />
              <Button size="xs" className={PANEL_ACTION} onClick={handleAutoSync} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {loading ? t('sync.finary.syncing') : t('sync.finary.sync')}
              </Button>
            </>
          }
        />
      )}

      {error && (
        <PanelError onRetry={() => wizard.setError(null)} retryLabel={t('common.close')}>
          {error}
        </PanelError>
      )}

      {(step === 2 || step === 3) && <FinaryStepIndicator step={step} variant="page" />}

      {/* Step 1: login (not connected) or the 2FA code (connected), then the file import */}
      {step === 1 && (
        <>
          {!isConnected && (
            <PanelForm
              onSubmit={handleLogin}
              actions={
                <Button type="submit" size="xs" disabled={loading || !email || !password} className={PANEL_ACTION}>
                  {loading && <Loader2 className="animate-spin" />}
                  {t('sync.finary.login')}
                </Button>
              }
            >
              <PanelField id="finary-email" label={t('sync.finary.email')} icon={Mail}>
                <Input
                  id="finary-email"
                  className={PANEL_INPUT}
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('sync.finary.emailPlaceholder')}
                  required
                />
              </PanelField>
              <PanelField id="finary-password" label={t('sync.finary.password')} icon={Lock}>
                <div className="relative">
                  <Input
                    id="finary-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`${PANEL_INPUT} pr-10`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                    aria-pressed={showPassword}
                    className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </PanelField>
            </PanelForm>
          )}

          {isConnected && (totpRequired || isTotpRequired) && (
            <PanelForm
              onSubmit={(e) => {
                e.preventDefault()
                wizard.syncWithTotp()
              }}
              step={{ icon: ShieldCheck, title: t('sync.finary.totpRequired') }}
              actions={
                <Button type="submit" size="xs" className={PANEL_ACTION} disabled={totpCode.length !== 6 || loading}>
                  {t('common.confirm')}
                  <ArrowRight />
                </Button>
              }
            >
              <PanelField id="finary-totp" label={t('sync.finary.totp')}>
                <Input
                  id="finary-totp"
                  className={PANEL_CODE_INPUT}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(e) => wizard.setTotpCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </PanelField>
            </PanelForm>
          )}

          <FinaryUploadZone variant="page" onFile={wizard.uploadFile} disabled={loading} />
        </>
      )}

      {/* Step 2: Account Mapping */}
      {step === 2 && previewData && (
        <FinaryMappingStep
          variant="page"
          preview={previewData}
          mappings={mappings}
          loading={loading}
          hasSkipAll={wizard.hasSkipAll}
          onBack={wizard.backToStart}
          onImport={wizard.importMapped}
          onActionChange={wizard.setMappingAction}
          onTargetChange={(index, id) => wizard.updateMapping(index, { targetAccountId: id })}
          onNewAccountField={wizard.updateNewAccountField}
        />
      )}

      {/* Step 3: Results */}
      {step === 3 && importResult && (
        <FinaryResultStep variant="page" result={importResult} onDone={wizard.reset} />
      )}

    </div>
  )
}
