/**
 * Dev/test rollback only. Production IdleScheduler path keeps this false.
 * See FLOWLARY_WRITING_RUNTIME_REDESIGN.md §17.
 */
let legacyImmediateCycle = false

export function isLegacyImmediateCycle(): boolean {
  return legacyImmediateCycle
}

export function setLegacyImmediateCycleForTests(value: boolean): void {
  legacyImmediateCycle = value
}

export function resetLegacyImmediateCycleForTests(): void {
  legacyImmediateCycle = false
}
