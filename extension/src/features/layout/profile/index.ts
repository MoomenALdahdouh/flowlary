import type { LayoutId, UserLayoutProfile } from '../layouts/types.ts'
import { DEFAULT_PROFILE, normalizeProfile } from '../layouts/profile.ts'
import { normalizeExceptions } from './exceptions.ts'
import { normalizeEvents, vocabularyHashesFromEvents } from './trust.ts'
import { LAYOUT_PROFILE_STORAGE_KEY, type CorrectionEvent } from './types.ts'
import { stateManager } from '../../../core/state/StateManager.ts'

export type LayoutProfileState = {
  layoutProfile: UserLayoutProfile
  personalExceptions: string[]
  events: CorrectionEvent[]
}

export const DEFAULT_LAYOUT_PROFILE_STATE: LayoutProfileState = {
  layoutProfile: DEFAULT_PROFILE,
  personalExceptions: [],
  events: [],
}

export function applyLayoutProfileToMemory(state: LayoutProfileState): void {
  stateManager.personalExceptions = [...state.personalExceptions]
  stateManager.vocabularyHashes = vocabularyHashesFromEvents(state.events)
}

export function normalizeLayoutProfileState(raw: unknown): LayoutProfileState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LAYOUT_PROFILE_STATE }
  const value = raw as Partial<LayoutProfileState & { enabledLayouts?: LayoutId[] }>
  return {
    layoutProfile: normalizeProfile(value.layoutProfile ?? value),
    personalExceptions: normalizeExceptions(value.personalExceptions),
    events: normalizeEvents(value.events),
  }
}

export function toUserLayoutProfile(
  sourceLayout: string,
  targetLayouts: string[],
): UserLayoutProfile {
  return normalizeProfile({
    sourceLayout,
    enabledLayouts: [sourceLayout, ...targetLayouts],
  })
}

export { LAYOUT_PROFILE_STORAGE_KEY }
