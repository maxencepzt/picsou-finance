import type { ComponentType } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { providerLogoUrl } from '@/lib/provider-logos'
import { cn, deriveMonogram } from '@/lib/utils'

/** The `Account.provider` string whose bundled logo stands for an integration, when one ships. */
const LOGO_PROVIDER: Record<string, string> = {
  boursobank: 'BoursoBank',
  traderepublic: 'Trade Republic',
}

/**
 * The mark of an integration in a list: its bundled logo, else its monogram, else (for a
 * category such as "crypto platforms" that has no brand) the given icon.
 */
export function IntegrationMark({
  integration,
  label,
  icon: Icon,
  className,
}: {
  integration: string
  label: string
  icon?: ComponentType<{ className?: string }>
  className?: string
}) {
  const src = providerLogoUrl(LOGO_PROVIDER[integration])
  return (
    <Avatar className={cn('size-9 rounded-lg after:rounded-lg', src && 'bg-white', className)}>
      {src && <AvatarImage src={src} alt="" className="rounded-lg object-contain p-1" />}
      <AvatarFallback className="rounded-lg text-[11px] font-bold text-foreground">
        {Icon ? <Icon className="size-4" /> : deriveMonogram(label)}
      </AvatarFallback>
    </Avatar>
  )
}
