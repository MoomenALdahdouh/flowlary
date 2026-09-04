import { createOperation, markOperationSuperseded } from './Operation.ts'
import { runtimeTrace } from './trace.ts'
import {
  type CreateOperationInput,
  type Operation,
  type OperationFeature,
  type OperationPurpose,
  isOperationLive,
  operationCoalesceKey,
} from './types.ts'

/**
 * Per-field operation tracking. Coalesces duplicate
 * (fieldId, revision, feature, purpose) keys.
 */
export class OperationRegistry {
  private readonly byId = new Map<string, Operation>()
  private readonly liveByKey = new Map<string, string>()

  begin(input: CreateOperationInput): Operation {
    const key = operationCoalesceKey(input.fieldId, input.revision, input.feature, input.purpose)
    const existingId = this.liveByKey.get(key)
    if (existingId) {
      const existing = this.byId.get(existingId)
      if (
        existing
        && existing.revision === input.revision
        && (
          isOperationLive(existing)
          || (
            existing.state === 'completed'
            && existing.snapshotFullText === input.snapshotFullText
          )
        )
      ) {
        runtimeTrace({
          name: 'COALESCE',
          operationId: existing.operationId,
          fieldId: existing.fieldId,
          revision: existing.revision,
          feature: existing.feature,
          purpose: existing.purpose,
        })
        return existing
      }
    }

    const operation = createOperation(input)
    this.byId.set(operation.operationId, operation)
    this.liveByKey.set(key, operation.operationId)
    return operation
  }

  get(operationId: string): Operation | undefined {
    return this.byId.get(operationId)
  }

  list(): Operation[] {
    return [...this.byId.values()]
  }

  liveForFeature(feature: OperationFeature, purpose: OperationPurpose): Operation[] {
    return this.list().filter(
      (item) => item.feature === feature && item.purpose === purpose && isOperationLive(item),
    )
  }

  /** Older revisions become permanently stale. Same-revision other features are kept. */
  invalidateOlderThan(sessionRevision: number): void {
    for (const operation of this.byId.values()) {
      if (operation.revision >= sessionRevision) continue
      const key = operationCoalesceKey(
        operation.fieldId,
        operation.revision,
        operation.feature,
        operation.purpose,
      )
      if (this.liveByKey.get(key) === operation.operationId) this.liveByKey.delete(key)
      markOperationSuperseded(operation)
      runtimeTrace({
        name: 'ABORT',
        operationId: operation.operationId,
        revision: operation.revision,
        feature: operation.feature,
        state: 'superseded',
      })
    }
  }

  clear(): void {
    for (const operation of this.byId.values()) markOperationSuperseded(operation)
    this.byId.clear()
    this.liveByKey.clear()
  }
}
