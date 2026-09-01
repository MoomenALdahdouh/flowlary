import { appendFileSync } from 'node:fs'

/**
 * Opt-in local debug sink. Disabled unless FLOWLARY_AGENT_DEBUG_LOG is a writable path.
 * Never enabled in production (FLOWLARY_ENV=production).
 */
export function appendAgentDebugLog(payload: Record<string, unknown>): void {
  if (process.env.FLOWLARY_ENV === 'production') return
  const path = process.env.FLOWLARY_AGENT_DEBUG_LOG?.trim()
  if (!path) return
  try {
    appendFileSync(path, `${JSON.stringify({ ...payload, timestamp: Date.now() })}\n`, 'utf8')
  } catch {
    /* ignore debug log failures */
  }
}
