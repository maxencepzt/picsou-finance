import { useTranslation } from 'react-i18next'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore, type SidebarStyle } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import picsouLogo from '@/assets/horizontal-white-picsou.svg'
import { NAV_ITEMS, CLASSIC_SETTINGS_NAV_ITEM, SYNC_NAV_ITEM } from './sidebar-nav-items'

const OPTIONS: { value: SidebarStyle; labelKey: string }[] = [
  { value: 'current', labelKey: 'settings.sidebarStyleCurrent' },
  { value: 'classic', labelKey: 'settings.sidebarStyleClassic' },
]

// A sketch of AppSidebar for each style: the same single-line rows (derived from NAV_ITEMS),
// with the profile row either right under the routes (classic, Settings among them) or pinned
// to the bottom under Sync and Settings (current), so the choice shows what it changes.
function SidebarPreview({ variant }: { variant: SidebarStyle }) {
  const isClassic = variant === 'classic'
  const navIcons = (isClassic ? [...NAV_ITEMS, CLASSIC_SETTINGS_NAV_ITEM] : NAV_ITEMS).map((item) => item.icon)
  const row = (Icon: LucideIcon, i: number, highlight = false) => (
    <div key={i} className={cn('flex items-center gap-1 rounded-sm px-0.5 py-px', highlight && 'bg-primary/15')}>
      <Icon className="size-2 shrink-0 text-muted-foreground" />
      <div className="h-1 w-3/5 rounded-full bg-foreground/20" />
    </div>
  )

  return (
    <div className="flex h-48 w-full gap-1.5 rounded-lg bg-muted/40 p-2" aria-hidden="true">
      <div data-slot="preview-sidebar" className="flex h-full w-1/2 flex-col rounded-md bg-background p-1.5">
        <div className="mb-2 flex items-center">
          <img src={picsouLogo} alt="" className="h-2 w-auto opacity-70 brightness-0 dark:invert" />
        </div>
        <div className="flex flex-col gap-0.5">{navIcons.map((Icon, i) => row(Icon, i, i === 0))}</div>
        <div className={cn('flex flex-col gap-0.5', isClassic ? 'mt-1.5' : 'mt-auto')}>
          {!isClassic && [SYNC_NAV_ITEM.icon, CLASSIC_SETTINGS_NAV_ITEM.icon].map((Icon, i) => row(Icon, i))}
          <div className="mt-0.5 flex items-center gap-0.5 border-t border-border px-0.5 pt-1">
            <div className="size-3 shrink-0 rounded-full bg-foreground/15" />
            <div className="ml-0.5 h-1 min-w-3 flex-1 rounded-full bg-foreground/20" />
            <ChevronDown className="size-2 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-1.5 rounded-md bg-background p-1.5">
        <div className="h-2.5 w-2/3 rounded-sm bg-muted" />
        <div className="h-8 rounded-sm bg-muted/60" />
      </div>
    </div>
  )
}

interface SidebarStylePromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Shown once — either right after setup or on a user's first normal login —
 * so the current/classic sidebar split (see AppSidebar.tsx) is an active
 * choice instead of a silent default. Picking an option closes the modal
 * immediately; dismissing it any other way (Escape, backdrop, close button)
 * also marks the prompt as seen, since re-showing it every session would be
 * more annoying than a silent default.
 */
export function SidebarStylePromptModal({ open, onOpenChange }: SidebarStylePromptModalProps) {
  const { t } = useTranslation()
  const sidebarStyle = useAppStore((s) => s.sidebarStyle)
  const setSidebarStyle = useAppStore((s) => s.setSidebarStyle)
  const setHasSeenSidebarStylePrompt = useAppStore((s) => s.setHasSeenSidebarStylePrompt)

  function handleOpenChange(next: boolean) {
    if (!next) setHasSeenSidebarStylePrompt(true)
    onOpenChange(next)
  }

  function choose(style: SidebarStyle) {
    setSidebarStyle(style)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('sidebarStylePrompt.title')}</DialogTitle>
          <DialogDescription>{t('sidebarStylePrompt.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('sidebarStylePrompt.title')}>
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={sidebarStyle === option.value}
              onClick={() => choose(option.value)}
              className="flex flex-col gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:border-primary/60 hover:bg-muted/40"
            >
              <SidebarPreview variant={option.value} />
              <span className="text-sm font-medium">{t(option.labelKey)}</span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">{t('sidebarStylePrompt.hint')}</p>
      </DialogContent>
    </Dialog>
  )
}
