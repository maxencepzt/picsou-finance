import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Landmark, Lock, RefreshCw, Smartphone } from "lucide-react"
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
  PanelWaiting,
} from "@/components/sync/ProviderPanel"
import { PANEL_ACTION, PANEL_INPUT } from "@/components/sync/panel-styles"
import {
  useProviderClear,
  useProviderComplete,
  useProviderInitiate,
  useProviderStatus,
  useProviderSync,
} from "@/features/sync/hooks"
import { extractErrorMessage, getErrorCode, getErrorStatus } from "@/lib/errors"
import { formatTimeAgo } from "@/lib/utils"
import type { BoursoErrorCode } from "@/types/api"

/**
 * There is no OTP state: BoursoBank's app validation is the only second factor
 * this connector drives, so the completion request simply stays open while the
 * user approves the push on their phone. An SMS or e-mail prompt comes back as
 * `MFA_TYPE_UNSUPPORTED` instead of a form we cannot honour.
 */
type AuthState = "IDLE" | "AWAITING_APP" | "ERROR"

interface BoursoPanelProps {
  onConnected?: () => void
}
export function BoursoPanel({ onConnected }: BoursoPanelProps = {}) {
  const { t } = useTranslation()
  const [authState, setAuthState] = useState<AuthState>("IDLE")
  const [customerId, setCustomerId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const notifyConnectedOnSuccess = useRef(false)

  const status = useProviderStatus("bourso")
  const initiate = useProviderInitiate("bourso")
  const complete = useProviderComplete("bourso")
  const sync = useProviderSync("bourso")
  const logout = useProviderClear("bourso")
  const { mutate: completeMutate } = complete

  const messageForCode = (value: BoursoErrorCode | string | null | undefined) => {
    switch (value) {
      case "INVALID_CREDENTIALS":
        return t("sync.bourso.errors.invalidCredentials")
      case "FRAUD_ACK_REQUIRED":
        return t("sync.bourso.errors.fraudAckRequired")
      case "IDENTITY_SELECTION_UNSUPPORTED":
        return t("sync.bourso.errors.identitySelectionUnsupported")
      case "MFA_TYPE_UNSUPPORTED":
        return t("sync.bourso.errors.mfaTypeUnsupported")
      case "APP_VALIDATION_TIMEOUT":
        return t("sync.bourso.errors.appValidationTimeout")
      case "AUTH_ATTEMPT_EXPIRED":
        return t("sync.bourso.errors.authAttemptExpired")
      case "SESSION_EXPIRED":
        return t("sync.bourso.errors.sessionExpired")
      case "PORTFOLIO_INCOMPLETE":
        return t("sync.bourso.errors.portfolioIncomplete")
      case "UPSTREAM_FORMAT_CHANGED":
        return t("sync.bourso.errors.formatChanged")
      case "INVALID_DATA":
        return t("sync.bourso.errors.invalidData")
      case "UPSTREAM_UNAVAILABLE":
      case "INTERNAL_ERROR":
        return t("sync.bourso.errors.serverError")
      default:
        return null
    }
  }

  const formatError = (value: unknown) => {
    const httpStatus = getErrorStatus(value)
    if (httpStatus === 429) return t("sync.bourso.errors.tooManyAttempts")
    const codedMessage = messageForCode(getErrorCode(value))
    if (codedMessage) return codedMessage
    return extractErrorMessage(value, t("sync.bourso.errors.serverError"))
  }

  const resetAuth = () => {
    setAuthState("IDLE")
  }

  const awaitAppValidation = (id: string) => {
    setError(null)
    completeMutate(
      { processId: id },
      {
        onSuccess: (result) => {
          notifyConnectedOnSuccess.current = true
          resetAuth()
          setCustomerId("")
          setPassword("")
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
        },
      }
    )
  }

  const connected = status.data?.isActive === true
  const syncStatus = status.data?.syncStatus ?? "IDLE"
  const isSyncing = syncStatus === "QUEUED" || syncStatus === "RUNNING"
  const requestingSync = sync.isPending || isSyncing
  const backgroundError =
    syncStatus === "FAILED"
      ? (messageForCode(status.data?.lastSyncError) ??
        t("sync.bourso.errors.serverError"))
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

  return (
    <div className="space-y-4">
      {connected ? (
        <PanelStatus
          tone={isSyncing ? "busy" : backgroundError ? "error" : "ok"}
          label={t("sync.bourso.sessionActive")}
          meta={[lastSync && t("sync.panel.lastSync", { time: formatTimeAgo(lastSync) })]}
          actions={
            <>
              <PanelDisconnect
                label={t("sync.bourso.clearSession")}
                provider={t("sync.bourso.title")}
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
                {requestingSync ? t("sync.bourso.syncing") : t("sync.bourso.sync")}
              </Button>
            </>
          }
        >
          {isSyncing && (
            <p className="text-muted-foreground">
              {syncStatus === "QUEUED" ? t("sync.bourso.queued") : t("sync.bourso.syncing")}
            </p>
          )}
          {syncStatus === "SUCCESS" && lastSync && (
            <p className="flex items-center gap-1.5 text-gain">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden />
              {t("sync.bourso.syncSuccess")}
            </p>
          )}
        </PanelStatus>
      ) : (
        // The provider view's header already says "not connected".
        <PanelIntro>{t("sync.bourso.scope")}</PanelIntro>
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
              { customerId, password },
              {
                onSuccess: (result) => {
                  setPassword("")
                  if (result.mfaRequired) {
                    if (!result.processId) {
                      setError(t("sync.bourso.errors.formatChanged"))
                      setAuthState("ERROR")
                      return
                    }
                    // Nothing to type: hold the completion request open while
                    // the user approves the push in the BoursoBank app.
                    setAuthState("AWAITING_APP")
                    awaitAppValidation(result.processId)
                    return
                  }
                  notifyConnectedOnSuccess.current = true
                  setCustomerId("")
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
              {initiate.isPending ? t("sync.bourso.connecting") : t("sync.bourso.connect")}
            </Button>
          }
        >
          <PanelField id="bourso-customer-id" label={t("sync.bourso.customerId")} icon={Landmark}>
            <Input
              id="bourso-customer-id"
              className={PANEL_INPUT}
              inputMode="numeric"
              autoComplete="username"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value.replace(/\D/g, ""))}
              required
            />
          </PanelField>
          <PanelField id="bourso-password" label={t("sync.bourso.password")} icon={Lock}>
            {/* BoursoBank passwords are digits only -- its virtual keyboard
                cannot encode anything else, and a stray character would spend
                a login attempt on a password the user never typed. */}
            <Input
              id="bourso-password"
              className={PANEL_INPUT}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value.replace(/\D/g, ""))}
              required
            />
          </PanelField>
        </PanelForm>
      )}

      {!connected && authState === "AWAITING_APP" && (
        <PanelWaiting
          icon={Smartphone}
          title={t("sync.bourso.appValidationPrompt")}
          hint={t("sync.bourso.appValidationHint")}
        />
      )}
    </div>
  )
}
