export type RuntimeTraceName =
  | 'REVISION'
  | 'OPERATION'
  | 'COALESCE'
  | 'INVALIDATE'
  | 'ABORT'
  | 'STALE'
  | 'SCHEDULE'
  | 'ARBITRATE'
  | 'ENGLISH_HTTP'

export type RuntimeTraceEvent = {
  name: RuntimeTraceName
  fieldId?: string
  revision?: number
  operationId?: string
  feature?: string
  purpose?: string
  state?: string
  verdict?: string
  reason?: string
  competing?: string
  /** Dev-only English HTTP probe — never includes text, tokens, or auth. */
  trigger?: string
  localFirst?: boolean
  pendingBefore?: boolean
  httpStatus?: number | string
  durationMs?: number
}

const TRACE_KEY = 'flowlary.runtimeTrace'

let testSink: ((line: string) => void) | null = null

export function setRuntimeTraceSinkForTests(sink: ((line: string) => void) | null): void {
  testSink = sink
}

export function isRuntimeTraceEnabled(): boolean {
  if (testSink) return true
  try {
    if (typeof localStorage === 'undefined') return false
    const flag = localStorage.getItem(TRACE_KEY)
    return flag === '1' || flag === 'true'
  } catch {
    return false
  }
}

/** Development-only. Must never include field snapshot text. */
export function runtimeTrace(event: RuntimeTraceEvent): void {
  if (!isRuntimeTraceEnabled()) return
  const parts: string[] = [event.name]
  if (event.revision !== undefined) parts.push(`revision=${event.revision}`)
  if (event.operationId) parts.push(`operation=${event.operationId}`)
  if (event.feature) parts.push(`feature=${event.feature}`)
  if (event.purpose) parts.push(`purpose=${event.purpose}`)
  if (event.state) parts.push(`state=${event.state}`)
  if (event.verdict) parts.push(`verdict=${event.verdict}`)
  if (event.reason) parts.push(`reason=${event.reason}`)
  if (event.competing) parts.push(`competing=${event.competing}`)
  if (event.fieldId) parts.push(`field=${event.fieldId}`)
  if (event.trigger) parts.push(`trigger=${event.trigger}`)
  if (event.localFirst !== undefined) parts.push(`localFirst=${event.localFirst}`)
  if (event.pendingBefore !== undefined) parts.push(`pendingBefore=${event.pendingBefore}`)
  if (event.httpStatus !== undefined) parts.push(`httpStatus=${event.httpStatus}`)
  if (event.durationMs !== undefined) parts.push(`durationMs=${event.durationMs}`)
  const line = parts.join(' ')
  testSink?.(line)
  if (!testSink && typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug(`[flowlary.runtime] ${line}`)
  }
}

export function assertTraceHasNoUserText(line: string, userText: string): boolean {
  if (!userText) return true
  return !line.includes(userText)
}
