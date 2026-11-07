/** True on macOS and iOS, where shortcuts use ⌘ instead of Ctrl. */
export function isApplePlatform(nav: Pick<Navigator, 'platform' | 'userAgent'> & { userAgentData?: { platform?: string } } = navigator): boolean {
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** The modifier key as printed on the keyboard: ⌘ on Apple platforms, Ctrl everywhere else. */
export function modifierKeyLabel(apple = isApplePlatform()): string {
  return apple ? '⌘' : 'Ctrl'
}

/** Whether a keydown is the "open search" shortcut: ⌘K on Apple platforms, Ctrl+K elsewhere. */
export function isSearchShortcut(event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, apple = isApplePlatform()): boolean {
  if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) return false
  return apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey
}
