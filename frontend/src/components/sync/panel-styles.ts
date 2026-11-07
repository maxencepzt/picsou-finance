/**
 * Shared sizing of the provider panels (Sync page, add-account modal): the compact 36px card
 * control, back to 40px under a finger so a touch target never shrinks below it.
 */
export const PANEL_INPUT = 'h-9 pointer-coarse:h-10'

/** A panel action: full width on a phone, its natural width from `sm`. Pair with `size="xs"`. */
export const PANEL_ACTION = 'w-full pointer-coarse:h-10 sm:w-auto'

/** A one-time code typed in one field: centred, spaced digits, the 40px OTP rhythm. */
export const PANEL_CODE_INPUT = 'h-10 max-w-56 text-center text-base font-semibold tracking-[0.3em] tabular-nums'

/** A native select drawn like the panel inputs (`NativeSelect` keeps its own 40px height). */
export const PANEL_SELECT = 'h-9 pointer-coarse:h-10 px-3'

/**
 * A `SegmentedControl` whose labels are sentences (skip / map / create): full width with equal
 * segments on a phone, the labels wrapping onto two lines instead of overlapping.
 */
export const PANEL_SEGMENTED_WRAP =
  'flex w-full sm:inline-flex sm:w-auto [&>button]:h-auto [&>button]:min-h-8 [&>button]:flex-1 [&>button]:basis-0 [&>button]:py-1 [&>button]:leading-tight [&>button]:whitespace-normal sm:[&>button]:flex-none sm:[&>button]:basis-auto'

/** The tone of a connection status code (bank requisition, exchange, Finary session). */
export function connectionTone(status: string | null | undefined): 'ok' | 'idle' | 'warning' | 'error' {
  switch (status) {
    case 'LINKED':
    case 'CONNECTED':
    case 'active':
      return 'ok'
    case 'EXPIRED':
    case 'TOTP_REQUIRED':
      return 'warning'
    case 'FAILED':
    case 'ERROR':
      return 'error'
    default:
      return 'idle'
  }
}
