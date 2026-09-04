export const RUNTIME_TRACE_STORAGE_KEY = 'flowlary.runtimeTrace'

export type RuntimeTraceEvent = {
  kind: string
  revision?: number
  operationId?: string
  fieldId?: string
  feature?: string
  purpose?: string
  state?: string
  coalesced?: boolean
}

export type RuntimeTraceSink = (event: RuntimeTraceEvent) => void

let testEnabled: boolean | null = null
let sink: RuntimeTraceSink | null = null

export function setRuntimeTraceEnabledForTests(enabled: boolean | null): void {
  testEnabled = enabled
}

export function setRuntimeTraceSinkForTests(next: RuntimeTraceSink | null): void {
  sink = next
}

export function resetRuntimeTraceForTests(): void {
  testEnabled = null
  sink = null
}

export function isRuntimeTraceEnabled(): boolean {
  if (testEnabled !== null) return testEnabled
  try {
    const value = globalThis.localStorage?.getItem(RUNTIME_TRACE_STORAGE_KEY)
    return value === '1' || value === 'true'
  } catch {
    return false
  }
}

/** Development-only. Never include field text or snapshot hashes of user content. */
export function runtimeTrace(event: RuntimeTraceEvent): void {
  if (!isRuntimeTraceEnabled()) return
  const safe: RuntimeTraceEvent = {
    kind: event.kind,
    revision: event.revision,
    operationId: event.operationId,
    fieldId: event.fieldId,
    feature: event.feature,
    purpose: event.purpose,
    state: event.state,
    coalesced: event.coalesced,
  }
  sink?.(safe)
  if (typeof console !== 'undefined' && typeof console.debug === 'function') {
    console.debug('[flowlary.runtime]', safe)
  }
}
