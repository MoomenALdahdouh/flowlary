import { STORAGE_KEYS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'

export type FirstWinState = {
  /** User finished first-win popup (CTA, skip, or success). */
  completed: boolean
  /** Layout or Speed Box used successfully on a page. */
  localSuccess: boolean
  /** First AI correction or translation succeeded. */
  aiSuccess: boolean
  completedAt?: number
}

const DEFAULT: FirstWinState = {
  completed: false,
  localSuccess: false,
  aiSuccess: false,
}

export function normalizeFirstWinState(raw: unknown): FirstWinState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT }
  const value = raw as Partial<FirstWinState>
  const localSuccess = value.localSuccess === true
  const aiSuccess = value.aiSuccess === true
  const completed =
    value.completed === true || localSuccess || aiSuccess
  return {
    completed,
    localSuccess,
    aiSuccess,
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : undefined,
  }
}

export async function getFirstWinState(storage: FlowlaryStorage): Promise<FirstWinState> {
  const raw = await storage.get(STORAGE_KEYS.uiFirstWin, 'local')
  return normalizeFirstWinState(raw)
}

export async function setFirstWinState(
  storage: FlowlaryStorage,
  patch: Partial<FirstWinState>,
): Promise<FirstWinState> {
  const current = await getFirstWinState(storage)
  const next = normalizeFirstWinState({
    ...current,
    ...patch,
    completedAt: patch.completed ? Date.now() : current.completedAt,
  })
  if (next.localSuccess || next.aiSuccess) {
    next.completed = true
    next.completedAt = next.completedAt ?? Date.now()
  }
  await storage.set(STORAGE_KEYS.uiFirstWin, next as unknown as Record<string, unknown>, 'local')
  return next
}

/** True once the user has had a first local or AI win (or explicitly skipped first-win). */
export function hasFirstProductSuccess(state: FirstWinState): boolean {
  return state.completed || state.localSuccess || state.aiSuccess
}
