import { flowlaryStorage } from '../index.ts'
import {
  createMigrationReader,
  ensureDefaultNamespaces,
  getMigrationState,
  setMigrationState,
} from '../facade.ts'
import {
  migrateEwaCorrection,
  migrateEwaGroqKey,
  migrateEwaHistoryPreserve,
} from './steps/ewa.ts'
import { migrateLingoEntitlement, migrateLingoTranslation } from './steps/lingo.ts'
import {
  migrateLayfixEntitlement,
  migrateLayfixEvents,
  migrateLayfixHistoryPreserve,
  migrateLayfixLayout,
} from './steps/layfix.ts'
import {
  buildDiagnostics,
  createInitialMigrationState,
  formatDiagnosticsReport,
  isLockStale,
  isMigrationComplete,
  isStepDone,
  MIGRATION_STEP_IDS,
  normalizeMigrationState,
  type MigrationState,
  type MigrationStepId,
  type MigrationStepResult,
} from './types.ts'

export type MigrationRunResult = {
  state: MigrationState
  diagnostics: ReturnType<typeof buildDiagnostics>
  report: string
}

let migrationPromise: Promise<MigrationRunResult> | null = null

async function loadMigrationState(): Promise<MigrationState> {
  return getMigrationState(flowlaryStorage)
}

async function saveMigrationState(state: MigrationState): Promise<void> {
  await setMigrationState(flowlaryStorage, state)
}

async function runStep(
  state: MigrationState,
  step: MigrationStepId,
  runner: () => Promise<MigrationStepResult>,
): Promise<MigrationState> {
  if (isStepDone(state, step)) return state

  const result = await runner()
  const next = { ...state, failedSteps: [...state.failedSteps] }

  if (result.ok) {
    if (!next.completedSteps.includes(step)) {
      next.completedSteps = [...next.completedSteps, step]
    }
    if (!next.verifiedSteps.includes(step)) {
      next.verifiedSteps = [...next.verifiedSteps, step]
    }
    next.failedSteps = next.failedSteps.filter((id) => id !== step)
  } else {
    if (!next.failedSteps.includes(step)) {
      next.failedSteps = [...next.failedSteps, step]
    }
    next.lastError = result.error ?? 'step_failed'
    next.status = 'PARTIAL'
  }

  return next
}

async function executeMigration(now: number): Promise<MigrationRunResult> {
  let state = normalizeMigrationState(await loadMigrationState())

  if (isMigrationComplete(state)) {
    const diagnostics = buildDiagnostics(state)
    return { state, diagnostics, report: formatDiagnosticsReport(diagnostics) }
  }

  if (state.status === 'RUNNING' && !isLockStale(state, now)) {
    const diagnostics = buildDiagnostics(state)
    return { state, diagnostics, report: formatDiagnosticsReport(diagnostics) }
  }

  state = {
    ...state,
    status: 'RUNNING',
    startedAt: state.startedAt ?? now,
    lockAcquiredAt: now,
    failedSteps: state.failedSteps.filter((id) => !isStepDone(state, id)),
  }
  await saveMigrationState(state)

  const reader = createMigrationReader(flowlaryStorage)

  try {
    const steps: Array<[MigrationStepId, () => Promise<MigrationStepResult>]> = [
      ['ewa_correction', () => migrateEwaCorrection(reader)],
      ['ewa_groq_key', () => migrateEwaGroqKey(reader)],
      ['ewa_history_preserve', () => migrateEwaHistoryPreserve(reader)],
      ['lingo_translation', () => migrateLingoTranslation(reader)],
      ['lingo_entitlement', () => migrateLingoEntitlement(reader, now)],
      ['layfix_layout', () => migrateLayfixLayout(reader)],
      ['layfix_events', () => migrateLayfixEvents(reader)],
      ['layfix_history_preserve', () => migrateLayfixHistoryPreserve(reader)],
      ['layfix_entitlement', () => migrateLayfixEntitlement(reader, now)],
    ]

    for (const [stepId, runner] of steps) {
      state = await runStep(state, stepId, runner)
      await saveMigrationState(state)
    }

    await ensureDefaultNamespaces(flowlaryStorage, now)

    state = {
      ...state,
      failedSteps: state.failedSteps.filter((id) => !state.verifiedSteps.includes(id)),
    }

    const allVerified = MIGRATION_STEP_IDS.every((id) => state.verifiedSteps.includes(id))
    const anyFailed = state.failedSteps.length > 0

    if (allVerified && !anyFailed) {
      state = {
        ...state,
        status: 'VERIFIED',
        completedAt: now,
        lockAcquiredAt: null,
        cleanupEligible: true,
      }
      await saveMigrationState(state)

      state = { ...state, status: 'COMPLETE', completedAt: now, lockAcquiredAt: null }
      await saveMigrationState(state)
    } else if (anyFailed) {
      state = { ...state, status: 'PARTIAL', lockAcquiredAt: null }
      await saveMigrationState(state)
    } else {
      state = { ...state, status: 'FAILED', lockAcquiredAt: null, lastError: 'incomplete_verification' }
      await saveMigrationState(state)
    }
  } catch (error) {
    state = {
      ...state,
      status: 'FAILED',
      lockAcquiredAt: null,
      lastError: error instanceof Error ? error.message : 'migration_crash',
    }
    await saveMigrationState(state)
  }

  const diagnostics = buildDiagnostics(state)
  return { state, diagnostics, report: formatDiagnosticsReport(diagnostics) }
}

export async function runStorageMigration(now = Date.now()): Promise<MigrationRunResult> {
  if (!migrationPromise) {
    migrationPromise = executeMigration(now).finally(() => {
      migrationPromise = null
    })
  }
  return migrationPromise
}

export async function getMigrationDiagnostics(): Promise<MigrationRunResult> {
  const state = await loadMigrationState()
  const diagnostics = buildDiagnostics(state)
  return { state, diagnostics, report: formatDiagnosticsReport(diagnostics) }
}

export function resetMigrationRunnerForTests(): void {
  migrationPromise = null
}

export { createInitialMigrationState, normalizeMigrationState }
