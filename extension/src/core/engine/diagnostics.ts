/**
 * INTERNAL / DEVELOPMENT ONLY.
 *
 * Read-only dogfood hook for Phase 2.1. Exposed on the content-script
 * isolated world as `globalThis.__FLOWLARY_DEBUG__` when engine mode is
 * exactly `internal_shadow`. Never injected into the page world.
 *
 * MUST NOT: write fields, mutate the DOM, change settings, acquire the
 * write lock, call APIs, persist data, or expose raw user text.
 */
import { resolveWritingPolicy, type WritingPolicySnapshot } from '../policy/writingPolicy.ts'
import {
  clearWriteTelemetry,
  getWriteTelemetrySnapshot as readWriteTelemetryRing,
  type WriteTelemetryEvent,
} from '../observability/writeTelemetry.ts'
import {
  getEngineMode,
  subscribeEngineModeChange,
  type EngineMode,
} from './flag.ts'
import {
  clearShadowDecisions,
  getShadowDecisionSnapshot as readShadowDecisionRing,
} from './telemetry.ts'
import type { ShadowDecisionEvent } from './types.ts'

export const DEBUG_GLOBAL_KEY = '__FLOWLARY_DEBUG__'

export type SanitizedWritingPolicy = WritingPolicySnapshot & {
  engineMode: EngineMode
}

export type FlowlaryInternalDebugApi = {
  /** INTERNAL / DEVELOPMENT ONLY */
  getEngineMode: () => EngineMode
  getEffectiveWritingPolicy: () => SanitizedWritingPolicy
  getShadowDecisionSnapshot: () => ShadowDecisionEvent[]
  getWriteTelemetrySnapshot: () => WriteTelemetryEvent[]
  clearDebugSnapshots: () => void
}

const DEBUG_API_KEYS = [
  'getEngineMode',
  'getEffectiveWritingPolicy',
  'getShadowDecisionSnapshot',
  'getWriteTelemetrySnapshot',
  'clearDebugSnapshots',
] as const

function cloneRing<T extends object>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item }))
}

export function getEffectiveWritingPolicy(): SanitizedWritingPolicy {
  const policy = resolveWritingPolicy()
  return {
    ...policy,
    engineMode: getEngineMode(),
  }
}

export function getDebugShadowDecisionSnapshot(): ShadowDecisionEvent[] {
  return cloneRing(readShadowDecisionRing())
}

export function getDebugWriteTelemetrySnapshot(): WriteTelemetryEvent[] {
  return cloneRing(readWriteTelemetryRing())
}

/** Clears only the two in-memory debug rings. Does not touch storage or user data. */
export function clearDebugSnapshots(): void {
  clearShadowDecisions()
  clearWriteTelemetry()
}

function createDebugApi(): FlowlaryInternalDebugApi {
  return Object.freeze({
    getEngineMode,
    getEffectiveWritingPolicy,
    getShadowDecisionSnapshot: getDebugShadowDecisionSnapshot,
    getWriteTelemetrySnapshot: getDebugWriteTelemetrySnapshot,
    clearDebugSnapshots,
  })
}

export function syncInternalDebugHook(): void {
  const root = globalThis as Record<string, unknown>
  if (getEngineMode() !== 'internal_shadow') {
    delete root[DEBUG_GLOBAL_KEY]
    return
  }
  const existing = root[DEBUG_GLOBAL_KEY]
  if (existing && typeof existing === 'object') return
  root[DEBUG_GLOBAL_KEY] = createDebugApi()
}

export function getInternalDebugHookForTests(): FlowlaryInternalDebugApi | undefined {
  const value = (globalThis as Record<string, unknown>)[DEBUG_GLOBAL_KEY]
  if (!value || typeof value !== 'object') return undefined
  return value as FlowlaryInternalDebugApi
}

export function debugApiKeys(): readonly string[] {
  return DEBUG_API_KEYS
}

subscribeEngineModeChange(syncInternalDebugHook)
