import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useEbCallLog, useClearEbCallLog } from '@/features/admin/hooks'
import { localeFromLanguage } from '@/lib/utils'
import type { EbCallEntry } from '@/features/admin/api'
import { SettingsCard, StatusText } from '../components/SettingsBlocks'

function HttpStatus({ status }: { status: number }) {
  const ok = status >= 200 && status < 300
  return <StatusText tone={ok ? 'ok' : 'error'} className="tabular-nums">{status}</StatusText>
}

function exportTxt(entries: EbCallEntry[]) {
  const lines = entries.map((e, i) => [
    `── [${i + 1}] ${new Date(e.timestamp).toISOString()} ──────────────────────────────`,
    `${e.method} ${e.url}`,
    `HTTP ${e.responseStatus}`,
    e.requestBody ? `\n>>> REQUEST BODY\n${tryPretty(e.requestBody)}` : '',
    `\n<<< RESPONSE BODY\n${tryPretty(e.responseBody)}`,
  ].filter(Boolean).join('\n'))
  const blob = new Blob([lines.join('\n\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `enable-banking-calls-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function tryPretty(json: string) {
  try { return JSON.stringify(JSON.parse(json), null, 2) } catch { return json }
}

function EbCallLogDialog() {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const { data, isLoading, isError, refetch } = useEbCallLog(true)
  const clear = useClearEbCallLog()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">
          {data ? t('admin.enableBanking.debug.count', { count: data.length }) : '—'}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="xs" onClick={() => refetch()}>
            <RotateCw aria-hidden="true" />
            {t('admin.enableBanking.debug.refresh')}
          </Button>
          {data && data.length > 0 && (
            <Button variant="outline" size="xs" onClick={() => exportTxt(data)}>
              <Download aria-hidden="true" />
              {t('admin.enableBanking.debug.export')}
            </Button>
          )}
          <Button
            variant="outline"
            size="xs"
            className="text-destructive hover:text-destructive"
            disabled={clear.isPending || !data?.length}
            onClick={() => { clear.mutate(); setExpandedIdx(null) }}
          >
            <Trash2 aria-hidden="true" />
            {t('admin.enableBanking.debug.clear')}
          </Button>
        </div>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
      )}
      {isError && (
        <p role="alert" className="text-sm text-destructive">{t('admin.enableBanking.debug.error')}</p>
      )}
      {!isLoading && !isError && data?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('admin.enableBanking.debug.empty')}</p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <div className="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-popover">
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="w-[120px] px-3 py-2 font-medium">{t('admin.aiActivity.colTime')}</th>
                <th className="w-[70px] px-3 py-2 font-medium">{t('admin.enableBanking.debug.colMethod')}</th>
                <th className="px-3 py-2 font-medium">{t('admin.enableBanking.debug.colEndpoint')}</th>
                <th className="w-[80px] px-3 py-2 font-medium">{t('admin.aiActivity.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, idx) => (
                <Fragment key={idx}>
                  <tr
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    aria-expanded={expandedIdx === idx}
                  >
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {new Date(entry.timestamp).toLocaleTimeString(locale)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs font-medium">
                      {entry.method}
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2 font-mono text-xs">
                      {entry.url.replace('https://api.enablebanking.com', '')}
                    </td>
                    <td className="px-3 py-2">
                      <HttpStatus status={entry.responseStatus} />
                    </td>
                  </tr>
                  {expandedIdx === idx && (
                    <tr className="border-b border-border bg-muted/30 last:border-0">
                      <td colSpan={4} className="space-y-3 px-3 pt-1 pb-3">
                        <p className="font-mono text-[11px] break-all text-muted-foreground">
                          {entry.method} {entry.url}
                        </p>
                        {entry.requestBody && (
                          <div>
                            <p className="mb-1 text-xs font-medium text-muted-foreground">{t('admin.enableBanking.debug.requestBody')}</p>
                            <pre className="max-h-48 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                              {tryPretty(entry.requestBody)}
                            </pre>
                          </div>
                        )}
                        <div>
                          <p className="mb-1 text-xs font-medium text-muted-foreground">{t('admin.enableBanking.debug.responseBody')}</p>
                          <pre className="max-h-96 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                            {tryPretty(entry.responseBody)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function EnableBankingDebugSection() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <SettingsCard
      title={t('admin.enableBanking.debug.title')}
      description={t('admin.enableBanking.debug.description')}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="xs">{t('admin.enableBanking.debug.view')}</Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{t('admin.enableBanking.debug.dialogTitle')}</DialogTitle>
            </DialogHeader>
            {open && <EbCallLogDialog />}
          </DialogContent>
        </Dialog>
      }
    />
  )
}
