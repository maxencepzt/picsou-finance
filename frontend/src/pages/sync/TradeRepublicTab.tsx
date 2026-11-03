import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, Upload } from 'lucide-react'
import type { TrSessionStatus } from '@/types/api'
import { formatDateTime } from '@/lib/utils'
import { TradeRepublicLogin } from '@/components/sync/TradeRepublicLogin'
import { PanelDisconnect, PanelLoading, PanelStatus } from '@/components/sync/ProviderPanel'
import { PANEL_ACTION } from '@/components/sync/panel-styles'

export function TradeRepublicTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: sessionStatus, isLoading: statusLoading } = useQuery<TrSessionStatus>({
    queryKey: ['sync', 'tr', 'status'],
    queryFn: () => api.get<TrSessionStatus>('/tr/status').then(r => r.data),
  })

  const isConnected = sessionStatus?.isActive ?? false

  const syncMutation = useMutation({
    mutationFn: () => api.post('/tr/sync').then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'tr', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const importCsvMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return api.post('/tr/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then(r => r.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api.delete('/tr/session').then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync', 'tr', 'status'] })
    },
  })

  function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) importCsvMutation.mutate(file)
  }

  if (statusLoading) return <PanelLoading />

  if (!isConnected) return <TradeRepublicLogin variant="page" />

  return (
    <div className="space-y-4">
      <PanelStatus
        tone="ok"
        label={t('sync.tr.sessionActive')}
        meta={[sessionStatus?.expiresAt && `${t('sync.tr.expiresAt')} ${formatDateTime(sessionStatus.expiresAt)}`]}
        actions={
          <>
            <PanelDisconnect
              label={t('sync.tr.clearSession')}
              provider={t('sync.tr.title')}
              pending={logoutMutation.isPending}
              onConfirm={() => logoutMutation.mutate()}
            />
            <Button
              variant="outline"
              size="xs"
              className={PANEL_ACTION}
              onClick={() => fileInputRef.current?.click()}
              disabled={importCsvMutation.isPending}
            >
              {importCsvMutation.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
              {t('sync.tr.importCsv')}
            </Button>
            <Button size="xs" className={PANEL_ACTION} onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
              <RefreshCw className={syncMutation.isPending ? 'animate-spin' : undefined} />
              {t('sync.tr.sync')}
            </Button>
          </>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleCsvChange}
      />
    </div>
  )
}
