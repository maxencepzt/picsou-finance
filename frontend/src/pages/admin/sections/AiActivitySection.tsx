import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAiCalls } from '@/features/admin/hooks'
import { localeFromLanguage } from '@/lib/utils'
import { SettingsCard, StatusText } from '../components/SettingsBlocks'

const LIMIT = 50

function CallStatus({ status }: { status: string }) {
  const tone = status === 'ERROR' ? 'error' : status === 'EMPTY' ? 'neutral' : 'ok'
  return <StatusText tone={tone}>{status}</StatusText>
}

function TokenCell({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>
  return <>{value}</>
}

function AiCallsDialog() {
  const { t, i18n } = useTranslation()
  const locale = localeFromLanguage(i18n.resolvedLanguage ?? i18n.language)
  const [offset, setOffset] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const { data, isLoading, isError } = useAiCalls(LIMIT, offset)

  const total = data?.total ?? 0
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + LIMIT, total)

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        {t('admin.aiActivity.summary', {
          calls: data?.total ?? 0,
          tokens: data?.totalTokens ?? 0,
        })}
      </p>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          <span className="animate-pulse">{t('admin.aiActivity.loading')}</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('error.serverError')}
        </p>
      )}

      {/* Empty */}
      {!isLoading && !isError && data?.items.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t('admin.aiActivity.empty')}
        </p>
      )}

      {/* Table */}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <div className="max-h-[60vh] overflow-auto rounded-xl ring-1 ring-border">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="sticky top-0 bg-popover">
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">{t('admin.aiActivity.colTime')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.aiActivity.colMerchant')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.aiActivity.colModel')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('admin.aiActivity.colTokens')}</th>
                  <th className="px-3 py-2 font-medium">{t('admin.aiActivity.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((call) => (
                  <Fragment key={call.id}>
                    <tr
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      aria-expanded={expandedId === call.id}
                      onClick={() =>
                        setExpandedId((prev) => (prev === call.id ? null : call.id))
                      }
                    >
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {new Date(call.createdAt).toLocaleString(locale)}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 font-medium">
                        {call.merchantLabel ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                        {call.model ? `${call.provider} / ${call.model}` : call.provider}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums">
                        <TokenCell value={call.promptTokens} />
                        {' / '}
                        <TokenCell value={call.completionTokens} />
                        {' / '}
                        <TokenCell value={call.totalTokens} />
                      </td>
                      <td className="px-3 py-2">
                        <CallStatus status={call.status} />
                      </td>
                    </tr>
                    {expandedId === call.id && (
                      <tr key={`${call.id}-detail`} className="border-b border-border bg-muted/30 last:border-0">
                        <td colSpan={5} className="px-3 pt-1 pb-3">
                          {call.error && (
                            <p className="mb-2 text-xs text-destructive">
                              <strong>{t('common.labelColon', { label: t('common.errorTitle') })}</strong> {call.error}
                            </p>
                          )}
                          {call.prompt && (
                            <div className="mb-2">
                              <p className="mb-1 text-xs font-medium text-muted-foreground">
                                {t('admin.aiActivity.prompt')}
                              </p>
                              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                                {call.prompt}
                              </pre>
                            </div>
                          )}
                          {call.response && (
                            <div>
                              <p className="mb-1 text-xs font-medium text-muted-foreground">
                                {t('admin.aiActivity.response')}
                              </p>
                              <pre className="max-h-64 overflow-auto rounded-md bg-muted p-2 font-mono text-[11px] whitespace-pre-wrap break-all">
                                {call.response}
                              </pre>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && data && total > 0 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-xs text-muted-foreground tabular-nums">
            {from}–{to} / {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              disabled={offset === 0}
              onClick={() => {
                setOffset((o) => Math.max(0, o - LIMIT))
                setExpandedId(null)
              }}
            >
              {t('admin.aiActivity.prev')}
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={offset + LIMIT >= total}
              onClick={() => {
                setOffset((o) => o + LIMIT)
                setExpandedId(null)
              }}
            >
              {t('admin.aiActivity.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AiActivitySection() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <SettingsCard
      title={t('admin.aiActivity.title')}
      description={t('admin.aiActivity.description')}
      action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="xs">{t('admin.aiActivity.view')}</Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{t('admin.aiActivity.title')}</DialogTitle>
            </DialogHeader>
            {open && <AiCallsDialog />}
          </DialogContent>
        </Dialog>
      }
    />
  )
}
