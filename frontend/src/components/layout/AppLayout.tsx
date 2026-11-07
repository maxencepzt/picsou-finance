import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AppSidebar } from './AppSidebar'
import { AppTopBar } from './AppTopBar'
import { CommandPalette } from './CommandPalette'
import { MobileBottomNav } from './MobileBottomNav'
import { SidebarStylePromptModal } from './SidebarStylePromptModal'
import { DegradedModeBanner } from '@/components/shared/DegradedModeBanner'
import { TelemetryRuntime } from '@/components/shared/TelemetryRuntime'
import { InstanceStatusDialog } from '@/components/shared/InstanceStatusDialog'
import { TelemetryConsentDialog } from '@/components/shared/TelemetryConsentDialog'
import { SyncAllModal } from '@/components/sync/SyncAllModal'
import { useAppStore } from '@/stores/app-store'
import { isSearchShortcut } from '@/lib/platform'

export function AppLayout() {
  const { t } = useTranslation()
  const hasSeenSidebarStylePrompt = useAppStore((s) => s.hasSeenSidebarStylePrompt)
  const [searchOpen, setSearchOpen] = useState(false)
  const [syncOpen, setSyncOpen] = useState(false)

  // ⌘K on macOS, Ctrl+K elsewhere, from any page.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSearchShortcut(event)) return
      event.preventDefault()
      setSearchOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* Keyboard skip-link: first focusable element, jumps past the nav straight to <main>. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t('common.skipToContent')}
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopBar onOpenSearch={() => setSearchOpen(true)} onSyncAll={() => setSyncOpen(true)} />
        <main id="main-content" tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] outline-none md:pb-0">
          <DegradedModeBanner />
          {/* Mobile: main stops where the fixed bottom nav starts (bar + bottom-4 + safe area);
              the p-4 gutter matches the nav's inset-x-4 and keeps the last card off its edge. */}
          <div className="flex-1 overflow-auto p-4 md:px-6 md:pt-6 md:pb-10">
            <div className="w-full max-w-[80rem]">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} onSyncAll={() => setSyncOpen(true)} />
      {/* Mounted only while open: the modal reads the status of every connector. */}
      {syncOpen && <SyncAllModal open onOpenChange={setSyncOpen} />}
      <TelemetryRuntime />
      <TelemetryConsentDialog />
      <InstanceStatusDialog />
      <SidebarStylePromptModal open={!hasSeenSidebarStylePrompt} onOpenChange={() => {}} />
    </div>
  )
}
