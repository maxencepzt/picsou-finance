import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2, Trash2, Smartphone, Monitor, ShieldCheck } from 'lucide-react'
import { useSessions, useRevokeSession } from '@/features/mfa/hooks'
import type { SessionItem } from '@/features/mfa/api'
import { resolveLocale } from '@/i18n/locales'
import { ROW_BUTTON } from '../SettingRow'

/** The "Remember me" devices, one row each. Closing all the others lives in the sensitive zone. */
export function SessionsList() {
  const { t, i18n } = useTranslation()
  const { data: sessions, isLoading } = useSessions()
  const revoke = useRevokeSession()

  if (isLoading) return <Skeleton className="h-12 w-full" />

  if (!Array.isArray(sessions) || sessions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('settings.sessionsEmpty')}</p>
  }

  return (
    <ul className="divide-y divide-border">
      {sessions.map(s => (
        <SessionRow
          key={s.id}
          session={s}
          locale={resolveLocale(i18n.language).intlLocale}
          onRevoke={() => revoke.mutate(s.id)}
          disabled={revoke.isPending && revoke.variables === s.id}
        />
      ))}
    </ul>
  )
}

function SessionRow({
  session,
  locale,
  onRevoke,
  disabled,
}: {
  session: SessionItem
  locale: string
  onRevoke: () => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const Icon = isProbablyMobile(session.userAgent) ? Smartphone : Monitor

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-48 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-sm font-medium text-foreground">
            {prettyUserAgent(session.userAgent, t('settings.sessionsBrowser')) || t('settings.sessionsUnknownDevice')}
          </span>
          {session.current && <Badge variant="secondary">{t('settings.sessionsCurrent')}</Badge>}
          {session.trustedFor2fa && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-gain">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              {t('settings.sessionsTrusted')}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {session.ipPrefix && <span className="font-mono">{session.ipPrefix}*</span>}
          {session.ipPrefix && ' · '}
          {t('common.labelColon', { label: t('settings.sessionsLastUsed') })}{' '}
          <span className="tabular-nums">{formatDate(session.lastUsedAt, locale)}</span>
        </p>
      </div>
      {!session.current && (
        <Button
          variant="ghost"
          size="xs"
          onClick={onRevoke}
          disabled={disabled}
          className={`${ROW_BUTTON} ml-auto shrink-0 text-destructive hover:text-destructive`}
        >
          {disabled ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
          {t('settings.sessionsRevoke')}
        </Button>
      )}
    </li>
  )
}

// ─── helpers ───────────────────────────────────────────────────────────

function isProbablyMobile(ua: string | null): boolean {
  if (!ua) return false
  return /Mobile|Android|iPhone|iPad/i.test(ua)
}

/**
 * Best-effort short label from a User-Agent string. Real UA parsing is a deep
 * rabbit hole — we extract just enough for "is this my phone or my laptop?"
 * recognition. The full UA is intentionally not shown (noisy + low value).
 */
function prettyUserAgent(ua: string | null, unknownBrowser: string): string {
  if (!ua) return ''
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) && !/Chrome\//.test(ua) ? 'Safari' :
    unknownBrowser
  const os =
    /Windows/.test(ua) ? 'Windows' :
    // Before macOS: an iPhone's UA says "like Mac OS X".
    /iPhone|iPad|iOS/.test(ua) ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /Linux/.test(ua) ? 'Linux' :
    ''
  return os ? `${browser} · ${os}` : browser
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
