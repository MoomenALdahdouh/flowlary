import { hashWritingSample } from '@flowlary/shared'
import { runtimeTrace } from './trace.ts'
import {
  type CreateOperationInput,
  type Operation,
  isOperationFresh,
  isOperationPermanentlyStale,
} from './types.ts'

let nextOperationSeq = 0

export function resetOperationIdsForTests(): void {
  nextOperationSeq = 0
}

function lockIdentity(operation: Operation): void {
  for (const key of [
    'operationId',
    'fieldId',
    'revision',
    'feature',
    'purpose',
    'trigger',
    'snapshotFullText',
    'snapshotHash',
  ] as const) {
    Object.defineProperty(operation, key, {
      value: operation[key],
      writable: false,
      configurable: false,
      enumerable: true,
    })
  }
}

export function createOperation(input: CreateOperationInput): Operation {
  const operationId = `op-${++nextOperationSeq}`
  const operation = {
    operationId,
    fieldId: input.fieldId,
    revision: input.revision,
    feature: input.feature,
    purpose: input.purpose,
    trigger: input.trigger,
    snapshotFullText: input.snapshotFullText,
    snapshotHash: hashWritingSample(input.snapshotFullText),
    abort: new AbortController(),
    state: 'pending',
  } as Operation
  lockIdentity(operation)
  runtimeTrace({
    name: 'OPERATION',
    operationId,
    fieldId: input.fieldId,
    revision: input.revision,
    feature: input.feature,
    purpose: input.purpose,
    state: 'pending',
  })
  return operation
}

function requestAbort(operation: Operation): void {
  if (!operation.abort.signal.aborted) operation.abort.abort()
}

export function markOperationSuperseded(operation: Operation): void {
  if (operation.state === 'superseded' || operation.state === 'failed') {
    requestAbort(operation)
    return
  }
  operation.state = 'superseded'
  requestAbort(operation)
  runtimeTrace({
    name: 'INVALIDATE',
    operationId: operation.operationId,
    fieldId: operation.fieldId,
    revision: operation.revision,
    feature: operation.feature,
    state: 'superseded',
  })
}

export function markOperationAborted(operation: Operation): void {
  if (
    operation.state === 'superseded'
    || operation.state === 'failed'
    || operation.state === 'completed'
    || operation.state === 'aborted'
  ) {
    requestAbort(operation)
    return
  }
  operation.state = 'aborted'
  requestAbort(operation)
}

export function markOperationFailed(operation: Operation): void {
  if (operation.state === 'superseded' || operation.state === 'aborted') return
  operation.state = 'failed'
  requestAbort(operation)
}

export function markOperationRunning(operation: Operation): void {
  if (operation.state === 'pending') operation.state = 'running'
}

export function markOperationCompleted(operation: Operation): void {
  if (
    operation.state === 'superseded'
    || operation.state === 'failed'
    || operation.state === 'aborted'
  ) {
    return
  }
  operation.state = 'completed'
}

/** @deprecated use markOperationCompleted */
export function markOperationSucceeded(operation: Operation): void {
  markOperationCompleted(operation)
}

export { isOperationFresh, isOperationPermanentlyStale }
