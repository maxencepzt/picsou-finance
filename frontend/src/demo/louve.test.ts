import { describe, expect, it } from 'vitest'
import { AxiosHeaders } from 'axios'
import { createDemoAdapter } from './index'
import type { LouveConnectionStatus, LouveStartResponse } from '@/types/api'

function call(adapter: ReturnType<typeof createDemoAdapter>, method: string, url: string) {
  return adapter({ method, url, headers: new AxiosHeaders() })
}

describe('Louve Invest demo', () => {
  it('connects through the callback route instead of leaving the demo', async () => {
    const adapter = createDemoAdapter()

    const start = (await call(adapter, 'POST', '/louve/auth/start')).data as LouveStartResponse
    // LouvePanel leaves the callback without posting it unless all three are there.
    const callback = new URL(start.authorizeUrl, 'http://demo.local')
    expect(callback.pathname).toBe('/sync/louve/callback')
    expect(['code', 'state', 'iss'].map((name) => callback.searchParams.get(name))).not.toContain(null)

    await call(adapter, 'POST', '/louve/auth/complete')
    const status = (await call(adapter, 'GET', '/louve/status')).data as LouveConnectionStatus
    expect(status.connected).toBe(true)

    await call(adapter, 'DELETE', '/louve/connection')
    expect(((await call(adapter, 'GET', '/louve/status')).data as LouveConnectionStatus).connected).toBe(false)
  })
})
