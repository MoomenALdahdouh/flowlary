import type { DecisionAction } from '../engine/types.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import { computeFeatureDeadlines, resolveLivePolicyInput } from './featurePolicies.ts'
import { markOperationFailed } from './Operation.ts'
import { runtimeTrace } from './trace.ts'
import type { Operation, OperationFeature, OperationTrigger } from './types.ts'
import { isOperationLive } from './types.ts'
import { evaluateOperationValidity } from './validity.ts'
import { authorizationForOperationWrite, type WriteAuthorization } from './writeAuthorization.ts'

export type ArbitrationFeature = 'layout' | 'translate' | 'english'

export type ArbitrationVerdict = 'ALLOW' | 'DEFER' | 'REJECT'

export type ArbitrationCandidateState =
  | 'READY'
  | 'DEFERRED'
  | 'COMMITTABLE'
  | 'REJECTED'
  | 'SUPERSEDED'

export type ArbitrationEffect = 'direct' | 'box'

/** Commit / Box occupancy rank. Higher wins. Matches redesign §10.4. */
export const COMMIT_RANK: Record<ArbitrationFeature, number> = {
  layout: 3,
  translate: 2,
  english: 1,
}

export type AutomaticCommitCandidate = {
  session: FieldSession
  operation: Operation
  feature: ArbitrationFeature
  action: DecisionAction
  effect: ArbitrationEffect
  range: { start: number; end: number }
  replacement: string
  boxOccupant?: ArbitrationFeature | null
  now?: number
  resume?: () => void
}

export type ArbitrationDecision = {
  verdict: ArbitrationVerdict
  reason: string
  candidateState: ArbitrationCandidateState
  operationId: string
  revision: number
  feature: ArbitrationFeature
  competingOperationIds: string[]
}

type Board = {
  deferred: Map<string, AutomaticCommitCandidate>
  commitInFlight: ArbitrationFeature | null
  boxOccupant: ArbitrationFeature | null
  flushing: boolean
}

const boards = new WeakMap<FieldSession, Board>()
const lastDecisions: ArbitrationDecision[] = []

export function resetArbitrationForTests(): void {
  lastDecisions.length = 0
}

export function takeArbitrationDecisionsForTests(): ArbitrationDecision[] {
  const copy = [...lastDecisions]
  lastDecisions.length = 0
  return copy
}

export function isAutomaticArbitrationTrigger(trigger: OperationTrigger): boolean {
  return trigger === 'auto' || trigger === 'focus_out'
}

export function featureFromAction(action: DecisionAction): ArbitrationFeature {
  if (action === 'layout_fix') return 'layout'
  if (action === 'translation') return 'translate'
  return 'english'
}

export function clearArbitrationBoard(session: FieldSession): void {
  const board = boards.get(session)
  if (!board) return
  for (const candidate of board.deferred.values()) {
    if (candidate.operation.revision < session.getRevision()) {
      runtimeTrace({
        name: 'ARBITRATE',
        operationId: candidate.operation.operationId,
        fieldId: candidate.operation.fieldId,
        revision: candidate.operation.revision,
        feature: candidate.feature,
        state: 'SUPERSEDED',
        verdict: 'REJECT',
        reason: 'revision_bump',
      })
    }
  }
  board.deferred.clear()
  board.commitInFlight = null
  board.boxOccupant = null
  board.flushing = false
}

export function hasDeferredCandidate(operationId: string, session: FieldSession): boolean {
  return boards.get(session)?.deferred.has(operationId) === true
}

function boardFor(session: FieldSession): Board {
  let board = boards.get(session)
  if (!board) {
    board = { deferred: new Map(), commitInFlight: null, boxOccupant: null, flushing: false }
    boards.set(session, board)
  }
  return board
}

function asArbitrationFeature(feature: OperationFeature): ArbitrationFeature | null {
  if (feature === 'layout' || feature === 'translate' || feature === 'english') return feature
  return null
}

function competingIds(session: FieldSession, candidate: AutomaticCommitCandidate): string[] {
  return session.operations
    .list()
    .filter(
      (item) =>
        item.operationId !== candidate.operation.operationId
        && item.revision === candidate.operation.revision
        && asArbitrationFeature(item.feature),
    )
    .map((item) => item.operationId)
}

function featurePending(
  session: FieldSession,
  feature: ArbitrationFeature,
  text: string,
  now: number,
): boolean {
  const live = session.operations.list().some(
    (item) =>
      item.feature === feature
      && item.revision === session.getRevision()
      && isOperationLive(item),
  )
  if (live) return true

  const settled = session.operations.list().some(
    (item) =>
      item.feature === feature
      && item.revision === session.getRevision()
      && (
        item.state === 'completed'
        || item.state === 'failed'
        || item.state === 'aborted'
      ),
  )
  if (settled) return false

  const deadlines = computeFeatureDeadlines(
    resolveLivePolicyInput({
      text,
      now,
      lastInputAt: session.getLastInputAt() || now,
      lastEnglishNetworkAt: session.getLastEnglishNetworkAt(),
      composing: session.isComposing(),
      focusOut: false,
    }),
  )
  return deadlines.has(feature)
}

function record(decision: ArbitrationDecision): ArbitrationDecision {
  lastDecisions.push(decision)
  runtimeTrace({
    name: 'ARBITRATE',
    operationId: decision.operationId,
    fieldId: undefined,
    revision: decision.revision,
    feature: decision.feature,
    state: decision.candidateState,
    verdict: decision.verdict,
    reason: decision.reason,
    competing: decision.competingOperationIds.join(','),
  })
  return decision
}

function finish(
  candidate: AutomaticCommitCandidate,
  verdict: ArbitrationVerdict,
  reason: string,
  candidateState: ArbitrationCandidateState,
): ArbitrationDecision {
  return record({
    verdict,
    reason,
    candidateState,
    operationId: candidate.operation.operationId,
    revision: candidate.operation.revision,
    feature: candidate.feature,
    competingOperationIds: competingIds(candidate.session, candidate),
  })
}

/**
 * Authoritative automatic commit/Box occupancy decision.
 * Validity is checked first. Does not mint WriteAuthorization.
 */
export function evaluateAutomaticArbitration(
  candidate: AutomaticCommitCandidate,
): ArbitrationDecision {
  const { session, operation, feature, effect } = candidate
  const validity = evaluateOperationValidity(operation, session.getRevision())
  if (!validity.ok) {
    boardFor(session).deferred.delete(operation.operationId)
    const state: ArbitrationCandidateState =
      validity.reason === 'stale_revision' || validity.reason === 'superseded'
        ? 'SUPERSEDED'
        : 'REJECTED'
    return finish(candidate, 'REJECT', validity.reason, state)
  }

  if (!isAutomaticArbitrationTrigger(operation.trigger)) {
    return finish(candidate, 'ALLOW', 'manual_bypass', 'COMMITTABLE')
  }

  const now = candidate.now ?? Date.now()
  const text = operation.snapshotFullText
  const board = boardFor(session)

  if (board.commitInFlight && board.commitInFlight !== feature) {
    const flyingRank = COMMIT_RANK[board.commitInFlight]
    if (flyingRank > COMMIT_RANK[feature]) {
      return deferOrReject(candidate, 'higher_rank_commit_in_flight')
    }
    if (flyingRank === COMMIT_RANK[feature] && effect === 'direct') {
      return finish(candidate, 'REJECT', 'same_rank_commit_in_flight', 'REJECTED')
    }
  }

  if (
    feature !== 'layout'
    && session.operations.list().some(
      (item) =>
        item.feature === 'layout'
        && item.revision === session.getRevision()
        && isOperationLive(item),
    )
  ) {
    return deferOrReject(candidate, 'layout_pending')
  }

  if (
    feature === 'english'
    && effect === 'direct'
    && featurePending(session, 'translate', text, now)
  ) {
    return deferOrReject(candidate, 'translate_pending')
  }

  if (effect === 'direct' && board.boxOccupant && COMMIT_RANK[board.boxOccupant] > COMMIT_RANK[feature]) {
    return deferOrReject(candidate, 'box_occupied_by_higher_rank')
  }

  if (effect === 'box' && candidate.boxOccupant) {
    const occupantRank = COMMIT_RANK[candidate.boxOccupant]
    if (occupantRank > COMMIT_RANK[feature]) {
      return finish(candidate, 'REJECT', 'box_occupied_by_higher_rank', 'REJECTED')
    }
  }

  board.deferred.delete(operation.operationId)
  if (effect === 'direct') board.commitInFlight = feature
  return finish(candidate, 'ALLOW', 'highest_ready', 'COMMITTABLE')
}

function deferOrReject(
  candidate: AutomaticCommitCandidate,
  reason: string,
): ArbitrationDecision {
  const board = boardFor(candidate.session)
  if (candidate.resume) {
    board.deferred.set(candidate.operation.operationId, candidate)
    return finish(candidate, 'DEFER', reason, 'DEFERRED')
  }
  board.deferred.delete(candidate.operation.operationId)
  return finish(candidate, 'REJECT', reason, 'REJECTED')
}

export function noteBoxOccupant(session: FieldSession, feature: ArbitrationFeature | null): void {
  boardFor(session).boxOccupant = feature
}

export function clearCommitInFlight(session: FieldSession): void {
  const board = boards.get(session)
  if (board) board.commitInFlight = null
}

export function abortLowerPriorityOperations(session: FieldSession, winner: ArbitrationFeature): void {
  const winnerRank = COMMIT_RANK[winner]
  for (const operation of session.operations.list()) {
    if (operation.revision !== session.getRevision()) continue
    const feature = asArbitrationFeature(operation.feature)
    if (!feature || COMMIT_RANK[feature] >= winnerRank) continue
    if (!isOperationLive(operation) && !hasDeferredCandidate(operation.operationId, session)) continue
    markOperationFailed(operation)
    boardFor(session).deferred.delete(operation.operationId)
  }
}

/**
 * Re-evaluate deferred candidates after a same-revision settlement.
 * Resume callbacks must not start new analysis or network.
 */
export function flushDeferredAutomaticCommits(session: FieldSession): void {
  const board = boards.get(session)
  if (!board || board.flushing) return
  board.flushing = true
  try {
    const pending = [...board.deferred.values()].sort(
      (left, right) => COMMIT_RANK[right.feature] - COMMIT_RANK[left.feature],
    )
    board.deferred.clear()
    for (const candidate of pending) {
      candidate.resume?.()
    }
  } finally {
    board.flushing = false
  }
}

export function prepareAutomaticWrite(candidate: AutomaticCommitCandidate): {
  decision: ArbitrationDecision
  authorization: WriteAuthorization | null
} {
  const decision = evaluateAutomaticArbitration(candidate)
  if (decision.verdict !== 'ALLOW') {
    return { decision, authorization: null }
  }
  const authorization = authorizationForOperationWrite({
    session: candidate.session,
    operation: candidate.operation,
    action: candidate.action,
    range: candidate.range,
    replacement: candidate.replacement,
    snapshotFullText: candidate.operation.snapshotFullText,
    purpose: candidate.operation.purpose,
    trigger: candidate.operation.trigger,
  })
  return { decision, authorization }
}
