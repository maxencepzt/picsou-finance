import type { LucideIcon } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, deriveMonogram } from '@/lib/utils'

const SIZES = { xs: 'size-6', sm: 'size-8', md: 'size-9', lg: 'size-11' } as const

/** From the capitalised words only, so "CIC (livrets)" reads CI and "Caisse d'Epargne" CE. */
function monogramOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter((w) => /^\p{Lu}/u.test(w))
  return deriveMonogram(words.join(' ') || name)
}

/**
 * A provider's mark: its logo on a white tile, else a generic icon (any bank, any exchange),
 * else its monogram. Same shape as the account marks of the Accounts page.
 */
export function ProviderMark({ name, logo, icon: Icon, size = 'md', className }: {
  name: string
  logo?: string | null
  icon?: LucideIcon
  size?: keyof typeof SIZES
  className?: string
}) {
  if (!logo && Icon) {
    return (
      <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-lg bg-muted text-foreground', SIZES[size], className)}>
        <Icon className={size === 'lg' ? 'size-5' : 'size-4'} aria-hidden />
      </span>
    )
  }
  return (
    // Decorative: the name always sits next to it, so the monogram must not join the accessible name.
    <Avatar aria-hidden className={cn('shrink-0 rounded-lg after:rounded-lg', logo && 'bg-white', SIZES[size], className)}>
      {logo && <AvatarImage src={logo} alt="" className={cn('rounded-lg object-contain', size === 'xs' ? 'p-0.5' : 'p-1')} />}
      <AvatarFallback className={cn('rounded-lg font-bold text-foreground', size === 'lg' ? 'text-sm' : size === 'xs' ? 'text-[9px]' : 'text-[11px]')}>
        {monogramOf(name)}
      </AvatarFallback>
    </Avatar>
  )
}
