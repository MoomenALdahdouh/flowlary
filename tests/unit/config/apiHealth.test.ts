import { afterEach, describe, expect, it, vi } from 'vitest'

describe('probeApiHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('marks health ok immediately after markApiHealthOk', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('fail', { status: 503 })),
    )
    const mod = await import('../../../extension/src/config/apiHealth.ts')
    mod.resetApiHealthCacheForTests()
    await mod.probeApiHealth({ force: true })
    expect(await mod.probeApiHealth()).toBe('offline')
    mod.markApiHealthOk()
    expect(await mod.probeApiHealth()).toBe('ok')
  })

  it('retries before reporting offline', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const mod = await import('../../../extension/src/config/apiHealth.ts')
    mod.resetApiHealthCacheForTests()
    expect(await mod.probeApiHealth({ force: true })).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
