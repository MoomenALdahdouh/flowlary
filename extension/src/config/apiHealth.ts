import { FLOWLARY_API_BASE, LOCAL_DEV_API_BASE } from './endpoints.ts'

export type ApiHealth = 'ok' | 'offline' | 'unknown'

const OK_TTL_MS = 15_000
/** Re-check quickly while offline so the UI recovers as soon as the API is back. */
const OFFLINE_TTL_MS = 4_000
const PROBE_TIMEOUT_MS = 4_000
const PROBE_ATTEMPTS = 2
const RECOVERY_INTERVAL_MS = 8_000

let cached: { value: ApiHealth; at: number } | null = null
let recoveryTimer: ReturnType<typeof setInterval> | null = null
let recoveryListener: (() => void) | null = null

export function isLocalDevApi(): boolean {
  if (import.meta.env.VITE_FLOWLARY_RELEASE === '1') return false
  const base = FLOWLARY_API_BASE.replace(/\/$/, '')
  if (base === LOCAL_DEV_API_BASE) return true
  return (
    base.includes('writing-api.test') ||
    base.includes('localhost:8787') ||
    base.includes('127.0.0.1:8787')
  )
}

export function localDevApiHint(): string | null {
  if (!isLocalDevApi()) return null
  return 'Local API: https://writing-api.test (keep npm run dev:api running)'
}

function probeTimeoutSignal(): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(PROBE_TIMEOUT_MS)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  return controller.signal
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stopRecoveryProbe(): void {
  if (recoveryTimer) {
    clearInterval(recoveryTimer)
    recoveryTimer = null
  }
}

function scheduleRecoveryProbe(): void {
  if (recoveryTimer) return
  recoveryTimer = setInterval(() => {
    void probeApiHealth({ force: true }).then((value) => {
      if (value === 'ok') recoveryListener?.()
    })
  }, RECOVERY_INTERVAL_MS)
}

/** Background/popup can refresh status when connectivity returns. */
export function onApiHealthRecovered(listener: () => void): void {
  recoveryListener = listener
}

export function markApiHealthOk(): void {
  cached = { value: 'ok', at: Date.now() }
  stopRecoveryProbe()
}

export function resetApiHealthCacheForTests(): void {
  cached = null
  stopRecoveryProbe()
  recoveryListener = null
}

export async function probeApiHealth(options?: { force?: boolean }): Promise<ApiHealth> {
  if (!options?.force && cached) {
    const ttl = cached.value === 'ok' ? OK_TTL_MS : OFFLINE_TTL_MS
    if (Date.now() - cached.at < ttl) {
      return cached.value
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(350)
    try {
      const response = await fetch(`${FLOWLARY_API_BASE}/health`, {
        method: 'GET',
        signal: probeTimeoutSignal(),
        cache: 'no-store',
      })
      const value: ApiHealth = response.ok ? 'ok' : 'offline'
      cached = { value, at: Date.now() }
      if (value === 'ok') {
        stopRecoveryProbe()
      } else {
        scheduleRecoveryProbe()
      }
      return value
    } catch (err) {
      lastError = err
    }
  }

  void lastError
  cached = { value: 'offline', at: Date.now() }
  scheduleRecoveryProbe()
  return 'offline'
}
