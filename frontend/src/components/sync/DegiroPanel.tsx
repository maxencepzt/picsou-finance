import { useEffect, useRef, useState } from "react"
import { Lock, RefreshCw, ShieldCheck, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  PanelDisconnect,
  PanelError,
  PanelField,
  PanelForm,
  PanelLoading,
  PanelStatus,
} from "@/components/sync/ProviderPanel"
import { PANEL_ACTION, PANEL_CODE_INPUT, PANEL_INPUT } from "@/components/sync/panel-styles"
import {
  useClearDegiroSession,
  useCompleteDegiroAuth,
  useDegiroSessionStatus,
  useInitiateDegiroAuth,
  useSyncDegiro,
} from "@/features/sync/hooks"
import { extractErrorMessage, getErrorDetail, getErrorStatus } from "@/lib/errors"
import { formatTimeAgo } from "@/lib/utils"

type AuthState = "IDLE" | "AWAITING_TOTP" | "ERROR"

interface DegiroPanelProps {
  onConnected?: () => void
}

export function DegiroPanel({ onConnected }: DegiroPanelProps = {}) {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState<AuthState>("IDLE")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [totpCode, setTotpCode] = useState("")
  const [processId, setProcessId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const notifyConnectedOnSuccess = useRef(false)

  const status = useDegiroSessionStatus()
  const initiate = useInitiateDegiroAuth()
  const complete = useCompleteDegiroAuth()
  const sync = useSyncDegiro()
  const logout = useClearDegiroSession()

  const formatError = (value: unknown) => {
    const httpStatus = getErrorStatus(value)
    if (httpStatus === 429) return t("sync.degiro.errors.tooManyAttempts")
    if (httpStatus === 401) return t("sync.degiro.errors.invalidCredentials")
    const detail = (getErrorDetail(value) ?? "").toLowerCase()
    if (detail.includes("expired") || detail.includes("reconnect"))
      return t("sync.degiro.errors.sessionExpired")
    if (detail.includes("totp") || detail.includes("code"))
      return t("sync.degiro.errors.invalidTotpCode")
    if (httpStatus && httpStatus >= 500) return t("sync.degiro.errors.serverError")
    return extractErrorMessage(value, t("sync.degiro.errors.serverError"))
  }

  const connected = status.data?.isActive === true
  const needsReauth = status.data?.status === "REAUTH_REQUIRED"
  const statusError = status.isError ? formatError(status.error) : null
  const visibleError = error ?? statusError

  // Depends on `connected`, not just `onConnected`: the ref is flipped inside a
  // mutation callback, so without a dep that actually changes when the session
  // goes live this effect never re-runs and the host modal never closes.
  useEffect(() => {
    if (!connected || !notifyConnectedOnSuccess.current) return
    notifyConnectedOnSuccess.current = false
    onConnected?.()
  }, [onConnected, connected])

  if (status.isLoading) return <PanelLoading />

  const lastSync = status.data?.lastSyncedAt
  const lastSyncLabel = lastSync && t("sync.panel.lastSync", { time: formatTimeAgo(lastSync) })
  const resetAuth = () => {
    setAuthState("IDLE")
    setProcessId(null)
    setTotpCode("")
  }

  return (
    <div className="space-y-4">
      {connected && !needsReauth ? (
        <PanelStatus
          tone="ok"
          label={t("sync.degiro.sessionActive")}
          meta={[lastSyncLabel]}
          actions={
            <>
              <PanelDisconnect
                label={t("sync.degiro.clearSession")}
                provider={t("sync.degiro.title")}
                pending={logout.isPending}
                onConfirm={() => {
                  setError(null)
                  logout.mutate(undefined, {
                    onSuccess: resetAuth,
                    onError: value => setError(formatError(value)),
                  })
                }}
              />
              <Button
                size="xs"
                className={PANEL_ACTION}
                onClick={() => {
                  setError(null)
                  sync.mutate(undefined, { onError: value => setError(formatError(value)) })
                }}
                disabled={sync.isPending}
              >
                <RefreshCw className={sync.isPending ? "animate-spin" : undefined} />
                {t("sync.degiro.sync")}
              </Button>
            </>
          }
        />
      ) : needsReauth ? (
        <PanelStatus tone="warning" label={t("sync.degiro.reauthRequired")} meta={[lastSyncLabel]} />
      ) : null}

      {visibleError && (
        <PanelError
          onRetry={() => {
            setError(null)
            resetAuth()
            if (statusError) void status.refetch()
          }}
        >
          {visibleError}
        </PanelError>
      )}

      {(!connected || needsReauth) && authState !== "AWAITING_TOTP" && (
        <PanelForm
          onSubmit={event => {
            event.preventDefault()
            setError(null)
            initiate.mutate(
              { username, password },
              {
                onSuccess: result => {
                  setPassword("")
                  if (result.totpRequired) {
                    if (!result.processId) {
                      // Shouldn't happen — the adapter rejects a blank processId before
                      // reporting totpRequired. Guarded anyway: without it a malformed
                      // response strands the user on a TOTP prompt that can never submit.
                      setError(t("sync.degiro.errors.serverError"))
                      setAuthState("ERROR")
                      return
                    }
                    setProcessId(result.processId)
                    setAuthState("AWAITING_TOTP")
                    return
                  }
                  notifyConnectedOnSuccess.current = true
                  setUsername("")
                  setAuthState("IDLE")
                  void status.refetch()
                },
                onError: value => {
                  setPassword("")
                  setError(formatError(value))
                  setAuthState("ERROR")
                },
              },
            )
          }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={initiate.isPending}>
              {initiate.isPending && <RefreshCw className="animate-spin" />}
              {t("sync.degiro.connect")}
            </Button>
          }
        >
          <PanelField id="degiro-panel-username" label={t("sync.degiro.username")} icon={User}>
            <Input
              id="degiro-panel-username"
              className={PANEL_INPUT}
              autoComplete="username"
              value={username}
              onChange={event => setUsername(event.target.value)}
              required
            />
          </PanelField>
          <PanelField id="degiro-panel-password" label={t("sync.degiro.password")} icon={Lock}>
            <Input
              id="degiro-panel-password"
              className={PANEL_INPUT}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
            />
          </PanelField>
        </PanelForm>
      )}

      {authState === "AWAITING_TOTP" && (
        <PanelForm
          onSubmit={event => {
            event.preventDefault()
            if (!processId) return
            setError(null)
            complete.mutate(
              { processId, code: totpCode },
              {
                onSuccess: () => {
                  notifyConnectedOnSuccess.current = true
                  setAuthState("IDLE")
                  setUsername("")
                  setPassword("")
                  setProcessId(null)
                  setTotpCode("")
                },
                onError: value => {
                  setError(formatError(value))
                  setAuthState("ERROR")
                  setProcessId(null)
                  setTotpCode("")
                },
              },
            )
          }}
          step={{ icon: ShieldCheck, title: t("sync.degiro.totpPrompt") }}
          actions={
            <Button type="submit" size="xs" className={PANEL_ACTION} disabled={complete.isPending}>
              {complete.isPending && <RefreshCw className="animate-spin" />}
              {t("sync.degiro.connect")}
            </Button>
          }
        >
          <PanelField id="degiro-panel-totp" label={t("sync.degiro.totpCode")}>
            <Input
              id="degiro-panel-totp"
              className={PANEL_CODE_INPUT}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totpCode}
              onChange={event => setTotpCode(event.target.value)}
              required
              autoFocus
            />
          </PanelField>
        </PanelForm>
      )}
    </div>
  )
}
