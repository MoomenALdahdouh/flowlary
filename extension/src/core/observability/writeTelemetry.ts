/**
 * Phase 1 privacy-safe write/decision ring buffer.
 * MUST NOT store raw user text. Debug inspection only — not product analytics UI.
 *
 * TODO(unified-writing-engine): fold into AnalyticsEvent taxonomy (spec §17).
 */

export type WriteTelemetryCapability = 'layout' | 'correction' | 'translation' | 'command'
export type WriteTelemetryTrigger = 'auto' | 'shortcut' | 'suggestion_accept' | 'manual_box'
export type WriteTelemetryOutcome =
  | 'attempted'
  | 'applied'
  | 'blocked'
  | 'stale'
  | 'noop'
  | 'skipped'

export type WriteTelemetryReason =
  | 'mutex_busy'
  | 'stale_generation'
  | 'stale_request'
  | 'composing'
  | 'protected_context'
  | 'unsupported_editor_auto_write'
  | 'shortcuts_only'
  | 'policy_blocked'
  | 'text_mismatch'
  | 'aborted'
  | 'written'
  | 'no_lock'

export type WriteTelemetryEvent = {
  id: number
  timestamp: number
  capability: WriteTelemetryCapability
  trigger: WriteTelemetryTrigger
  outcome: WriteTelemetryOutcome
  reasonCodes: WriteTelemetryReason[]
  fieldKind: 'text' | 'textarea' | 'contenteditable' | 'unknown'
  composing: boolean
  shadowOnly: boolean
  metrics: {
    rangeLength: number
  }
}

export type RecordWriteTelemetryInput = {
  capability: WriteTelemetryCapability
  trigger: WriteTelemetryTrigger
  outcome: WriteTelemetryOutcome
  reasonCodes: WriteTelemetryReason[]
  fieldKind?: WriteTelemetryEvent['fieldKind']
  composing?: boolean
  rangeLength?: number
  /** Reserved for Phase 2 shadow mode. Phase 1 always false. */
  shadowOnly?: boolean
}

const MAX_EVENTS = 80
const events: WriteTelemetryEvent[] = []
let nextId = 1

export function recordWriteTelemetry(input: RecordWriteTelemetryInput): WriteTelemetryEvent {
  const event: WriteTelemetryEvent = {
    id: nextId++,
    timestamp: Date.now(),
    capability: input.capability,
    trigger: input.trigger,
    outcome: input.outcome,
    reasonCodes: [...input.reasonCodes],
    fieldKind: input.fieldKind ?? 'unknown',
    composing: input.composing === true,
    shadowOnly: input.shadowOnly === true,
    metrics: {
      rangeLength: Math.max(0, Math.floor(input.rangeLength ?? 0)),
    },
  }
  events.push(event)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
  return event
}

export function getWriteTelemetrySnapshot(): readonly WriteTelemetryEvent[] {
  return events.slice()
}

export function clearWriteTelemetry(): void {
  events.length = 0
}

export function fieldKindFromElement(element: Element | null | undefined): WriteTelemetryEvent['fieldKind'] {
  if (!element) return 'unknown'
  if (element instanceof HTMLTextAreaElement) return 'textarea'
  if (element instanceof HTMLInputElement) return 'text'
  if (element instanceof HTMLElement && element.isContentEditable) return 'contenteditable'
  return 'unknown'
}
