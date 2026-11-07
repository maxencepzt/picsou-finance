import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Copy, Check, ShieldAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertBanner } from '@/components/shared/AlertBanner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { formatApiError } from '@/lib/errors'
import { cn, formatDate, formatTimeAgo } from '@/lib/utils'
import { useAccessKeys, useCreateAccessKey, useRevokeAccessKey } from '@/features/accessKeys/hooks'
import { READ_SCOPES, WRITE_SCOPES, scopeI18nKey } from '@/features/accessKeys/scopes'
import { keyStatus, type KeyStatus } from '@/features/accessKeys/status'
import type { AccessKeyCreated } from '@/features/accessKeys/api'
import { ROW_BUTTON, SettingsCard, StatusDot } from '../SettingRow'

const STATUS_TONE: Record<KeyStatus, 'on' | 'warn' | 'off'> = { active: 'on', expired: 'warn', revoked: 'off' }
const STATUS_LABEL: Record<KeyStatus, string> = {
  active: 'accessKeys.statusActive',
  expired: 'accessKeys.statusExpired',
  revoked: 'accessKeys.statusRevoked',
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <Button variant="outline" size="xs" className={cn(ROW_BUTTON, 'shrink-0 self-start @md:self-auto')} onClick={onClick}>
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? t('accessKeys.copied') : t('accessKeys.copy')}
    </Button>
  )
}

// One accessible, checkbox-like toggle for a single scope. No native checkbox
// primitive exists in the design system, so we expose a button with the proper
// ARIA role/state instead of faking it with a styled div.
function ScopeToggle({
  scope,
  checked,
  onToggle,
}: {
  scope: string
  checked: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const k = scopeI18nKey(scope)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
        checked ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
        )}
        aria-hidden
      >
        {checked && <Check className="size-3" />}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{t(`accessKeys.scopes.${k}.label`)}</span>
        <span className="block text-xs text-muted-foreground">{t(`accessKeys.scopes.${k}.desc`)}</span>
        <code className="block break-all font-mono text-[10px] text-muted-foreground">{scope}</code>
      </span>
    </button>
  )
}

export function AccessKeysSection() {
  const { t } = useTranslation()
  const { data: keys, isLoading } = useAccessKeys()
  const createKey = useCreateAccessKey()
  const revokeKey = useRevokeAccessKey()

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [created, setCreated] = useState<AccessKeyCreated | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)
  const [endpointCopied, setEndpointCopied] = useState(false)
  const [snippetCopied, setSnippetCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<number | null>(null)

  const endpoint = `${window.location.origin}/mcp`
  const snippet = useMemo(
    () =>
      JSON.stringify(
        {
          mcpServers: {
            picsou: {
              command: 'npx',
              args: ['mcp-remote', endpoint, '--header', 'Authorization: Bearer psk_YOUR_KEY'],
            },
          },
        },
        null,
        2,
      ),
    [endpoint],
  )

  // Earliest selectable expiry is tomorrow, so a date picked at UTC-midnight is
  // always strictly in the future and passes the backend's @Future check.
  const minExpiry = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [])

  function openCreate() {
    setName('')
    setSelectedScopes([])
    setExpiresAt('')
    setCreated(null)
    createKey.reset()
    setCreateOpen(true)
  }

  function toggleScope(scope: string) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed || selectedScopes.length === 0) return
    createKey.mutate(
      {
        name: trimmed,
        scopes: selectedScopes,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      },
      { onSuccess: (result) => setCreated(result) },
    )
  }

  async function handleCopy(text: string, setFlag: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text)
      setFlag(true)
      setTimeout(() => setFlag(false), 1500)
    } catch {
      /* clipboard may be unavailable over plain HTTP; the user can select-copy */
    }
  }

  function handleRevoke() {
    if (revokingId == null) return
    revokeKey.mutate(revokingId, { onSuccess: () => setRevokingId(null) })
  }

  const canSubmit = !!name.trim() && selectedScopes.length > 0 && !createKey.isPending

  return (
    <>
      <SettingsCard
        title={t('accessKeys.keysTitle')}
        action={
          <Button size="xs" className={ROW_BUTTON} onClick={openCreate}>
            <Plus aria-hidden="true" />
            {t('accessKeys.newKey')}
          </Button>
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('accessKeys.loading')}</p>
        ) : !Array.isArray(keys) || keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('accessKeys.empty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {keys.map((k) => {
              const status = keyStatus(k)
              return (
                <li key={k.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-56 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-sm font-medium text-foreground">{k.name}</span>
                      <StatusDot tone={STATUS_TONE[status]}>{t(STATUS_LABEL[status])}</StatusDot>
                      <code className="font-mono text-xs text-muted-foreground">{k.keyPrefix}…</code>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {k.lastUsedAt
                        ? t('accessKeys.lastUsed', { value: formatTimeAgo(k.lastUsedAt) })
                        : t('accessKeys.lastUsedNever')}
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      {k.expiresAt
                        ? t('accessKeys.expires', { value: formatDate(k.expiresAt) })
                        : t('accessKeys.expiresNever')}
                    </p>
                  </div>
                  {status !== 'revoked' && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className={cn(ROW_BUTTON, 'ml-auto shrink-0 text-destructive hover:text-destructive')}
                      onClick={() => setRevokingId(k.id)}
                    >
                      <Trash2 aria-hidden="true" />
                      {t('accessKeys.revoke')}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </SettingsCard>

      {/* Connect your MCP client -------------------------------------------- */}
      <SettingsCard title={t('accessKeys.connectTitle')} description={t('accessKeys.connectIntro')}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-muted-foreground">{t('accessKeys.connectEndpointLabel')}</p>
            <div className="flex flex-col gap-2 @md:flex-row @md:items-center">
              <code className="flex min-h-9 flex-1 items-center break-all rounded-lg bg-muted px-3 py-1.5 font-mono text-[13px] text-foreground">
                {endpoint}
              </code>
              <CopyButton copied={endpointCopied} onClick={() => handleCopy(endpoint, setEndpointCopied)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-muted-foreground">{t('accessKeys.connectSnippetLabel')}</p>
              <CopyButton copied={snippetCopied} onClick={() => handleCopy(snippet, setSnippetCopied)} />
            </div>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-[13px] leading-relaxed text-foreground">
              {snippet}
            </pre>
          </div>

          <p className="flex items-start gap-2 text-[13px] text-warning">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('accessKeys.connectHttpsWarning')}
          </p>
        </div>
      </SettingsCard>

      {/* Create / secret dialog --------------------------------------------- */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false) }}>
        <DialogContent className="flex! max-h-[calc(100dvh-2rem)]! w-[calc(100vw-2rem)]! max-w-none! flex-col gap-0 overflow-hidden p-0 text-sm sm:w-[42rem]!">
          {created ? (
            <>
              <DialogHeader className="shrink-0 px-5 pt-5 pr-14">
                <DialogTitle>{t('accessKeys.secretTitle')}</DialogTitle>
                <DialogDescription>{t('accessKeys.secretWarning')}</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 overflow-y-auto px-5 py-4">
                <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <code className="flex min-h-10 flex-1 items-center break-all rounded-xl bg-background px-4 py-2 font-mono text-sm">
                      {created.secret}
                    </code>
                    <Button
                      variant="outline"
                      className="w-full shrink-0 sm:w-auto sm:min-w-36"
                      onClick={() => handleCopy(created.secret, setSecretCopied)}
                    >
                      {secretCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {secretCopied ? t('accessKeys.copied') : t('accessKeys.copy')}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter className="shrink-0 px-5 pb-5">
                <Button onClick={() => setCreateOpen(false)}>{t('accessKeys.done')}</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader className="shrink-0 px-5 pt-5 pr-14">
                <DialogTitle>{t('accessKeys.createTitle')}</DialogTitle>
                <DialogDescription>{t('accessKeys.createDescription')}</DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ak-name">{t('accessKeys.nameLabel')}</Label>
                    <Input
                      id="ak-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('accessKeys.namePlaceholder')}
                      maxLength={100}
                      autoFocus
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('accessKeys.permissionsLabel')}</Label>
                    <p className="text-xs font-medium text-muted-foreground">{t('accessKeys.groupRead')}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {READ_SCOPES.map((s) => (
                        <ScopeToggle
                          key={s}
                          scope={s}
                          checked={selectedScopes.includes(s)}
                          onToggle={() => toggleScope(s)}
                        />
                      ))}
                    </div>
                    <p className="pt-1 text-xs font-medium text-muted-foreground">{t('accessKeys.groupWrite')}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {WRITE_SCOPES.map((s) => (
                        <ScopeToggle
                          key={s}
                          scope={s}
                          checked={selectedScopes.includes(s)}
                          onToggle={() => toggleScope(s)}
                        />
                      ))}
                    </div>
                    {selectedScopes.length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('accessKeys.selectScopeHint')}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ak-expiry">{t('accessKeys.expiryLabel')}</Label>
                    <Input
                      id="ak-expiry"
                      type="date"
                      min={minExpiry}
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full sm:w-48"
                    />
                    <p className="text-xs text-muted-foreground">{t('accessKeys.expiryHint')}</p>
                  </div>

                  {createKey.isError && (
                    <AlertBanner variant="bordered" role="alert">
                      {formatApiError(createKey.error, t, 'accessKeys.error')}
                    </AlertBanner>
                  )}
                </div>
              </div>
              <DialogFooter className="shrink-0 px-5 pb-5">
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createKey.isPending}>
                  {t('accessKeys.cancel')}
                </Button>
                <Button onClick={handleCreate} disabled={!canSubmit}>
                  {createKey.isPending ? t('accessKeys.creating') : t('accessKeys.create')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirm ------------------------------------------------------ */}
      <ConfirmDialog
        open={revokingId !== null}
        onOpenChange={(o) => { if (!o) { setRevokingId(null); revokeKey.reset() } }}
        title={t('accessKeys.revokeTitle')}
        description={t('accessKeys.revokeDescription')}
        confirmLabel={t('accessKeys.revoke')}
        onConfirm={handleRevoke}
        loading={revokeKey.isPending}
        error={revokeKey.isError ? formatApiError(revokeKey.error, t) : undefined}
        variant="destructive"
      />
    </>
  )
}
