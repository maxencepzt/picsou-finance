import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Lock, PiggyBank, RefreshCw, ShieldCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PanelDisconnect,
  PanelError,
  PanelField,
  PanelForm,
  PanelIntro,
  PanelLoading,
  PanelStatus,
} from "@/components/sync/ProviderPanel"
import { PANEL_ACTION, PANEL_CODE_INPUT, PANEL_INPUT } from "@/components/sync/panel-styles"
import {
  useProviderClear,
  useProviderComplete,
  useProviderInitiate,
  useProviderStatus,
  useProviderSync,
} from "@/features/sync/hooks"
import { formatFortuneoError, fortuneoErrorMessage } from "@/lib/errors"
import { formatTimeAgo } from "@/lib/utils"
import type { FortuneoErrorCode } from "@/types/api"

type AuthState = "IDLE" | "AWAITING_OTP" | "ERROR"

interface FortuneoPanelProps {
  onConnected?: () => void
}
export function FortuneoPanel({ onConnected }: FortuneoPanelProps = {}) {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState<AuthState>("IDLE")
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [processId, setProcessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const notifyConnectedOnSuccess = useRef(false)

  const status = useProviderStatus("fortuneo")
  const initiate = useProviderInitiate("fortuneo")
  const complete = useProviderComplete("fortuneo")
  const sync = useProviderSync("fortuneo")
  const logout = useProviderClear("fortuneo")

  const messageForCode = (code: FortuneoErrorCode | string | null | undefined) =>
    fortuneoErrorMessage(t, code)

  const formatError = (value: unknown) => formatFortuneoError(value, t)

  const connected = status.data?.isActive === true
  const syncStatus = status.data?.syncStatus ?? "IDLE"
  const isSyncing = syncStatus === "QUEUED" || syncStatus === "RUNNING"
  const requestingSync = sync.isPending || isSyncing
  const backgroundError =
    syncStatus === "FAILED"
      ? (messageForCode(status.data?.lastSyncError) ??
        t("sync.fortuneo.errors.serverError"))
      : null
  const statusError = status.isError ? formatError(status.error) : null
  const visibleError = error ?? backgroundError ?? statusError

  useEffect(() => {
    if (syncStatus !== "SUCCESS" || !notifyConnectedOnSuccess.current) return
    notifyConnectedOnSuccess.current = false
    onConnected?.()
  }, [onConnected, syncStatus])

  if (status.isLoading) return <PanelLoading />

  const lastSync = status.data?.lastSyncCompletedAt
  const resetAuth = () => {
    setAuthState("IDLE")
    setProcessId(null)
    setCode("")
  }

  return (
    <div className="space-y-4">
      {connected ? (
        <PanelStatus
          tone={isSyncing ? "busy" : backgroundError ? "error" : "ok"}
          label={t("sync.fortuneo.sessionActive")}
          meta={[lastSync && t("sync.panel.lastSync", { time: formatTimeAgo(lastSync) })]}
          actions={
            <>
              <PanelDisconnect
                label={t("sync.fortuneo.clearSession")}
                provider={t("sync.fortuneo.title")}
                pending={logout.isPending}
                onConfirm={() => {
                  setError(null)
                  logout.mutate(undefined, {
                    onSuccess: () => {
                      notifyConnectedOnSuccess.current = false
                      resetAuth()
                    },
                    onError: (value) => setError(formatError(value)),
                  })
                }}
              />
              <Button
                size="xs"
                className={PANEL_ACTION}
                onClick={() => {
                  setError(null)
                  sync.mutate(undefined, {
                    onError: (value) => setError(formatError(value)),
                  })
                }}
                disabled={requestingSync}
              >
                <RefreshCw className={requestingSync ? "animate-spin" : undefined} />
                {requestingSync ? t("sync.fortuneo.syncing") : t("sync.fortuneo.sync")}
              </Button>
            </>
          }
        >
          {isSyncing && (
            <p className="text-muted-foreground">
              {syncStatus === "QUEUED" ? t("sync.fortuneo.queued") : t("sync.fortuneo.syncing")}
            </p>
          )}
          {syncStatus === "SUCCESS" && lastSync && (
            <p className="flex items-center gap-1.5 text-gain">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t("sync.fortuneo.syncSuccess")}
            </p>
          )}
        </PanelStatus>
      ) : (
        // The provider view's header already says "not connected".
        <PanelIntro>{t("sync.fortuneo.scope")}</PanelIntro>
      )}

      {visibleError && (
        <PanelError
          onRetry={
            error || statusError
              ? () => {
                  setError(null)
                  resetAuth()
                  if (statusError) void status.refetch()
                }
              : undefined
          }
        >
          {visibleError}
        </PanelError>
      )}

      {!connected && authState === "IDLE" && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            setError(null)
            initiate.mutate(
              { login, password },
              {
                onSuccess: (result) => {
                  setPassword("")
                  if (result.mfaRequired) {
                    if (!result.processId) {
                      setError(t("sync.fortuneo.errors.formatChanged"))
                      setAuthState("ERROR")
                      return
                    }
                    setProcessId(result.processId)
                    setAuthState("AWAITING_OTP")
                    return
                  }
                  notifyConnectedOnSuccess.current = true
                  setLogin("")
                  setAuthState("IDLE")
                  void status.refetch()
                },
                onError: (value) => {
                  setPassword("")
                  setError(formatError(value))
                  setAuthState("ERROR")
                },
              }
            )
          }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={initiate.isPending}>
              {initiate.isPending && <RefreshCw className="animate-spin" />}
              {initiate.isPending ? t("sync.fortuneo.connecting") : t("sync.fortuneo.connect")}
            </Button>
          }
        >
          <PanelField id="fortuneo-login" label={t("sync.fortuneo.login")} icon={PiggyBank}>
            <Input
              id="fortuneo-login"
              className={PANEL_INPUT}
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              required
            />
          </PanelField>
          <PanelField id="fortuneo-password" label={t("sync.fortuneo.password")} icon={Lock}>
            <Input
              id="fortuneo-password"
              className={PANEL_INPUT}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </PanelField>
        </PanelForm>
      )}

      {!connected && authState === "AWAITING_OTP" && (
        <PanelForm
          onSubmit={(event) => {
            event.preventDefault()
            if (!processId) return
            setError(null)
            complete.mutate(
              { processId, code },
              {
                onSuccess: (result) => {
                  notifyConnectedOnSuccess.current = true
                  setAuthState("IDLE")
                  setLogin("")
                  setPassword("")
                  setProcessId(null)
                  setCode("")
                  if (result.syncStatus === "SUCCESS") {
                    notifyConnectedOnSuccess.current = false
                    onConnected?.()
                  } else {
                    void status.refetch()
                  }
                },
                onError: (value) => {
                  setError(formatError(value))
                  setAuthState("ERROR")
                  setProcessId(null)
                  setCode("")
                },
              }
            )
          }}
          step={{ icon: ShieldCheck, title: t("sync.fortuneo.otpPrompt") }}
          actions={
            <Button
              type="submit"
              size="xs"
              className={PANEL_ACTION}
              disabled={complete.isPending || code.length !== 6}
            >
              {complete.isPending && <RefreshCw className="animate-spin" />}
              {complete.isPending ? t("sync.fortuneo.validating") : t("sync.fortuneo.validate")}
            </Button>
          }
        >
          <PanelField id="fortuneo-otp" label={t("sync.fortuneo.otpCode")}>
            <Input
              id="fortuneo-otp"
              className={PANEL_CODE_INPUT}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              required
              autoFocus
            />
          </PanelField>
        </PanelForm>
      )}
    </div>
  )
}
