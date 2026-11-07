import { describe, expect, it } from 'vitest'
import { isApplePlatform, isSearchShortcut, modifierKeyLabel } from './platform'

const key = (overrides: Partial<KeyboardEvent>) => ({ key: 'k', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...overrides })

describe('platform shortcuts', () => {
  it('recognises Apple platforms from the client hints, the platform or the user agent', () => {
    expect(isApplePlatform({ platform: '', userAgent: '', userAgentData: { platform: 'macOS' } })).toBe(true)
    expect(isApplePlatform({ platform: 'MacIntel', userAgent: '' })).toBe(true)
    expect(isApplePlatform({ platform: '', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' })).toBe(true)
    expect(isApplePlatform({ platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe(false)
    expect(isApplePlatform({ platform: 'Linux x86_64', userAgent: '' })).toBe(false)
  })

  it('prints ⌘ on Apple platforms and Ctrl elsewhere', () => {
    expect(modifierKeyLabel(true)).toBe('⌘')
    expect(modifierKeyLabel(false)).toBe('Ctrl')
  })

  it('opens search with ⌘K on Apple platforms and Ctrl+K elsewhere, nothing else', () => {
    expect(isSearchShortcut(key({ metaKey: true }), true)).toBe(true)
    expect(isSearchShortcut(key({ ctrlKey: true }), true)).toBe(false)
    expect(isSearchShortcut(key({ ctrlKey: true }), false)).toBe(true)
    expect(isSearchShortcut(key({ key: 'K', ctrlKey: true }), false)).toBe(true)
    expect(isSearchShortcut(key({ metaKey: true }), false)).toBe(false)
    expect(isSearchShortcut(key({ ctrlKey: true, shiftKey: true }), false)).toBe(false)
    expect(isSearchShortcut(key({ key: 'j', ctrlKey: true }), false)).toBe(false)
  })
})
