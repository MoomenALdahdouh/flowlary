import type { FieldSession } from '../session/FieldSession.ts'
import { setDomGeneration, getGenerationMap } from './write.ts'

/** Align DOM WeakMap generation with FieldSession (authoritative). */
export function syncDomGeneration(element: Element, session: FieldSession): void {
  setDomGeneration(element, session.getGeneration())
}

/** Bump user-initiated generation in session and DOM together. */
export function bumpUserGeneration(element: Element, session: FieldSession): number {
  const generation = session.bumpGeneration()
  setDomGeneration(element, generation)
  return generation
}

/** Read DOM generation (falls back to session when synced). */
export function readDomGeneration(element: Element): number {
  return getGenerationMap().get(element) ?? 0
}
