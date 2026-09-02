import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultLearningProfile } from '@flowlary/shared'
import { loadWebLearningBundle } from './learningData.ts'
import * as eventsClient from '../../account/learningEventsClient.ts'
import * as syncClient from '../../account/learningSyncClient.ts'

const ACCOUNT = 'acct-test-1'

describe('loadWebLearningBundle', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns remote data when GETs succeed', async () => {
    vi.spyOn(eventsClient, 'fetchLearningEvents').mockResolvedValue({
      ok: true,
      store: { version: 1, events: [], samples: [] },
    })
    vi.spyOn(syncClient, 'fetchRemoteLearningProfile').mockResolvedValue({
      ok: true,
      value: { ...createDefaultLearningProfile(), nativeLanguage: 'ar', updatedAt: Date.now() + 60_000 },
    })
    vi.spyOn(syncClient, 'fetchRemotePracticeSessions').mockResolvedValue({
      ok: true,
      value: { version: 1, sessions: [] },
    })
    const pushProfile = vi.spyOn(syncClient, 'pushRemoteLearningProfile').mockResolvedValue(true)
    const pushPractice = vi.spyOn(syncClient, 'pushRemotePracticeSessions').mockResolvedValue(true)

    const result = await loadWebLearningBundle(ACCOUNT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.degraded).toBe(false)
    expect(result.bundle.profile.nativeLanguage).toBe('ar')
    expect(pushProfile).not.toHaveBeenCalled()
    expect(pushPractice).not.toHaveBeenCalled()
  })

  it('does not treat 401 as empty success', async () => {
    vi.spyOn(eventsClient, 'fetchLearningEvents').mockResolvedValue({ ok: false, code: 'auth' })
    vi.spyOn(syncClient, 'fetchRemoteLearningProfile').mockResolvedValue({ ok: false, code: 'auth' })
    vi.spyOn(syncClient, 'fetchRemotePracticeSessions').mockResolvedValue({ ok: false, code: 'auth' })
    const pushPractice = vi.spyOn(syncClient, 'pushRemotePracticeSessions')

    const result = await loadWebLearningBundle(ACCOUNT)
    expect(result).toEqual({ ok: false, code: 'auth' })
    expect(pushPractice).not.toHaveBeenCalled()
  })

  it('falls back to local store on network failure without pushing over remote', async () => {
    vi.spyOn(eventsClient, 'fetchLearningEvents').mockResolvedValue({ ok: false, code: 'network' })
    vi.spyOn(syncClient, 'fetchRemoteLearningProfile').mockResolvedValue({ ok: false, code: 'network' })
    vi.spyOn(syncClient, 'fetchRemotePracticeSessions').mockResolvedValue({ ok: false, code: 'network' })
    const pushPractice = vi.spyOn(syncClient, 'pushRemotePracticeSessions').mockResolvedValue(true)

    const result = await loadWebLearningBundle(ACCOUNT)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.degraded).toBe(true)
    expect(result.bundle.store.events).toEqual([])
    expect(pushPractice).not.toHaveBeenCalled()
  })
})
