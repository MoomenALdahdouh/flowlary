/**
 * Engine mode for the unified writing path.
 *
 * Production content-script initialization (`establishEngineMode`) upgrades an
 * unset mode to `enforce`. Explicit developer/test overrides are honored:
 *   off | internal_shadow | enforce
 *
 * How to override (no popup control):
 * 1. Content-script console (that tab only):
 *    globalThis.__FLOWLARY_ENGINE_MODE__ = 'internal_shadow' | 'off' | 'enforce'
 * 2. Persist for this browser profile:
 *    chrome.storage.local.set({ 'flowlary.debug.engineMode': 'internal_shadow' })
 * 3. Tests: setInternalEngineMode('internal_shadow' | 'off' | 'enforce')
 *
 * Missing / invalid storage value is not an override. After establishEngineMode,
 * that case becomes enforce.
 */
import { ENGINE_FLAG_KEY, type EngineMode } from './types.ts'

export { ENGINE_FLAG_KEY }
export type { EngineMode }

const GLOBAL_KEY = '__FLOWLARY_ENGINE_MODE__'
const EXPLICIT_MODES = new Set<EngineMode>(['off', 'internal_shadow', 'enforce'])

let memoryMode: EngineMode = 'off'
let storageMode: EngineMode = 'off'
let memoryExplicit = false
let storageExplicit = false
let watchingGlobal = false
let watchingStorage = false
let globalModeOverride: unknown
const modeListeners = new Set<() => void>()

export function subscribeEngineModeChange(listener: () => void): () => void {
  modeListeners.add(listener)
  return () => {
    modeListeners.delete(listener)
  }
}

function notifyEngineModeChange(): void {
  for (const listener of modeListeners) listener()
}

export function parseEngineMode(value: unknown): EngineMode {
  if (value === 'enforce') return 'enforce'
  if (value === 'internal_shadow') return 'internal_shadow'
  return 'off'
}

function isExplicitModeToken(value: unknown): value is EngineMode {
  return typeof value === 'string' && EXPLICIT_MODES.has(value as EngineMode)
}

function rawGlobalMode(): unknown {
  return watchingGlobal
    ? globalModeOverride
    : (globalThis as Record<string, unknown>)[GLOBAL_KEY]
}

export function setInternalEngineMode(mode: EngineMode): void {
  memoryMode = parseEngineMode(mode)
  memoryExplicit = true
  notifyEngineModeChange()
}

export function setStoredEngineMode(mode: EngineMode): void {
  storageMode = parseEngineMode(mode)
  storageExplicit = true
  notifyEngineModeChange()
}

export function installEngineModeGlobalWatch(): void {
  if (watchingGlobal) return
  const root = globalThis as Record<string, unknown>
  globalModeOverride = root[GLOBAL_KEY]
  Object.defineProperty(globalThis, GLOBAL_KEY, {
    configurable: true,
    enumerable: false,
    get() {
      return globalModeOverride
    },
    set(value: unknown) {
      globalModeOverride = value
      notifyEngineModeChange()
    },
  })
  watchingGlobal = true
}

export function getEngineMode(): EngineMode {
  const globalValue = rawGlobalMode()
  if (isExplicitModeToken(globalValue)) return globalValue
  if (memoryExplicit) return memoryMode
  if (memoryMode !== 'off') return memoryMode
  if (storageExplicit) return storageMode
  if (storageMode !== 'off') return storageMode
  return 'off'
}

export function hasExplicitEngineModeOverride(): boolean {
  if (isExplicitModeToken(rawGlobalMode())) return true
  if (memoryExplicit) return true
  if (storageExplicit) return true
  return false
}

export function isShadowEngineEnabled(): boolean {
  return getEngineMode() === 'internal_shadow'
}

export function isEnforceEngineEnabled(): boolean {
  return getEngineMode() === 'enforce'
}

export function resetEngineModeForTests(): void {
  memoryMode = 'off'
  storageMode = 'off'
  memoryExplicit = false
  storageExplicit = false
  globalModeOverride = undefined
  watchingGlobal = false
  watchingStorage = false
  delete (globalThis as Record<string, unknown>)[GLOBAL_KEY]
  notifyEngineModeChange()
}

function unwrapStoredMode(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && raw !== null && 'value' in raw) {
    return (raw as { value: unknown }).value
  }
  return raw
}

export async function hydrateEngineModeFromStorage(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) {
    storageMode = 'off'
    storageExplicit = false
    notifyEngineModeChange()
    return
  }
  try {
    const bag = (await chrome.storage.local.get(ENGINE_FLAG_KEY)) as Record<string, unknown>
    const raw = bag[ENGINE_FLAG_KEY]
    if (raw === undefined) {
      storageMode = 'off'
      storageExplicit = false
    } else {
      const unwrapped = unwrapStoredMode(raw)
      storageMode = parseEngineMode(unwrapped)
      storageExplicit = isExplicitModeToken(unwrapped)
    }
    notifyEngineModeChange()
  } catch {
    storageMode = 'off'
    storageExplicit = false
    notifyEngineModeChange()
  }
}

export function applyProductionEngineModeDefault(): void {
  if (hasExplicitEngineModeOverride()) return
  if (getEngineMode() === 'off') setInternalEngineMode('enforce')
}

export function installEngineModeStorageListener(): void {
  if (watchingStorage) return
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return
  watchingStorage = true
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !(ENGINE_FLAG_KEY in changes)) return
    const next = changes[ENGINE_FLAG_KEY]?.newValue
    if (next === undefined) {
      storageMode = 'off'
      storageExplicit = false
    } else {
      const unwrapped = unwrapStoredMode(next)
      storageMode = parseEngineMode(unwrapped)
      storageExplicit = isExplicitModeToken(unwrapped)
    }
    notifyEngineModeChange()
  })
}
