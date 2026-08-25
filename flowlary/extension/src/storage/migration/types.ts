export type MigrationStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'PARTIAL'
  | 'VERIFIED'
  | 'COMPLETE'
  | 'FAILED'

export const MIGRATION_VERSION = 1

export const MIGRATION_STEP_IDS = [
  'ewa_correction',
  'ewa_groq_key',
  'ewa_history_preserve',
  'lingo_translation',
  'lingo_entitlement',
  'layfix_layout',
  'layfix_events',
  'layfix_history_preserve',
  'layfix_entitlement',
] as const

export type MigrationStepId = (typeof MIGRATION_STEP_IDS)[number]

export type MigrationStepResult = {
  id: MigrationStepId
  ok: boolean
  skipped?: boolean
  error?: string
}

export type MigrationState = {
  _v: number
  version: number
  status: MigrationStatus
  startedAt: number | null
  completedAt: number | null
  lockAcquiredAt: number | null
  completedSteps: MigrationStepId[]
  failedSteps: MigrationStepId[]
  verifiedSteps: MigrationStepId[]
  cleanupEligible: boolean
  lastError?: string
}

export const LOCK_TTL_MS = 5 * 60 * 1000

export function createInitialMigrationState(): MigrationState {
  return {
    _v: MIGRATION_VERSION,
    version: MIGRATION_VERSION,
    status: 'NOT_STARTED',
    startedAt: null,
    completedAt: null,
    lockAcquiredAt: null,
    completedSteps: [],
    failedSteps: [],
    verifiedSteps: [],
    cleanupEligible: false,
  }
}

export function normalizeMigrationState(raw: unknown): MigrationState {
  const fallback = createInitialMigrationState()
  if (!raw || typeof raw !== 'object') return fallback
  const value = raw as Partial<MigrationState>
  const validStatus = (
    [
      'NOT_STARTED',
      'RUNNING',
      'PARTIAL',
      'VERIFIED',
      'COMPLETE',
      'FAILED',
    ] as const
  ).includes(value.status as MigrationStatus)
    ? (value.status as MigrationStatus)
    : fallback.status

  const filterSteps = (steps: unknown): MigrationStepId[] =>
    Array.isArray(steps)
      ? steps.filter((step): step is MigrationStepId =>
          MIGRATION_STEP_IDS.includes(step as MigrationStepId),
        )
      : []

  return {
    _v: MIGRATION_VERSION,
    version: MIGRATION_VERSION,
    status: validStatus,
    startedAt: typeof value.startedAt === 'number' ? value.startedAt : null,
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : null,
    lockAcquiredAt: typeof value.lockAcquiredAt === 'number' ? value.lockAcquiredAt : null,
    completedSteps: filterSteps(value.completedSteps),
    failedSteps: filterSteps(value.failedSteps),
    verifiedSteps: filterSteps(value.verifiedSteps),
    cleanupEligible: value.cleanupEligible === true,
    lastError: typeof value.lastError === 'string' ? value.lastError : undefined,
  }
}

export function isMigrationComplete(state: MigrationState): boolean {
  return state.status === 'COMPLETE' || state.status === 'VERIFIED'
}

export function isStepDone(state: MigrationState, step: MigrationStepId): boolean {
  return state.verifiedSteps.includes(step)
}

export function isLockStale(state: MigrationState, now = Date.now()): boolean {
  if (state.status !== 'RUNNING' || state.lockAcquiredAt == null) return true
  return now - state.lockAcquiredAt >= LOCK_TTL_MS
}

export type MigrationDiagnostics = {
  status: MigrationStatus
  steps: Array<{ id: MigrationStepId; state: 'done' | 'pending' | 'failed' | 'skipped' }>
}

export function buildDiagnostics(state: MigrationState): MigrationDiagnostics {
  return {
    status: state.status,
    steps: MIGRATION_STEP_IDS.map((id) => {
      if (state.verifiedSteps.includes(id)) {
        return { id, state: state.completedSteps.includes(id) ? 'done' : 'skipped' as const }
      }
      if (state.failedSteps.includes(id)) return { id, state: 'failed' as const }
      return { id, state: 'pending' as const }
    }),
  }
}

export function formatDiagnosticsReport(diagnostics: MigrationDiagnostics): string {
  const lines = ['Migration:']
  for (const step of diagnostics.steps) {
    const mark =
      step.state === 'done' ? '✓' : step.state === 'skipped' ? '○' : step.state === 'failed' ? '✗' : '·'
    lines.push(`${mark} ${step.id.replace(/_/g, ' ')}`)
  }
  return lines.join('\n')
}
