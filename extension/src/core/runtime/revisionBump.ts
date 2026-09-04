type RevisionListener = (fieldId: string, revision: number) => void

const listeners = new Set<RevisionListener>()
let sameRevisionReanalyze: ((fieldId: string) => void) | null = null

export function onFieldRevisionBump(listener: RevisionListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyFieldRevisionBump(fieldId: string, revision: number): void {
  for (const listener of listeners) listener(fieldId, revision)
}

export function registerSameRevisionReanalyze(handler: ((fieldId: string) => void) | null): void {
  sameRevisionReanalyze = handler
}

export function requestSameRevisionReanalyze(fieldId: string): void {
  sameRevisionReanalyze?.(fieldId)
}

export function resetRevisionBumpListenersForTests(): void {
  listeners.clear()
  sameRevisionReanalyze = null
}
