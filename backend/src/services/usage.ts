import { recordManagedUsage } from './accountService.ts'

export type AiUsageRecord = {
  requestId: string
  userId: string
  accountId?: string | null
  operation: 'correction' | 'translation' | 'layout-classification' | 'hypothesis-advisor' | 'writing-review'
  model: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  reasoningTokens?: number
  finishReason?: string
  fallbackUsed?: boolean
  fallbackReason?: string
  fallbackPosition?: number
  errorClass?: string
  estimatedCostUsd?: number
  status: 'success' | 'failure'
  latencyMs: number
  createdAt: number
  plan?: string
  clientClaim?: string | null
  mode?: string | null
  telemetryKind?: 'operation' | 'provider-attempt'
  meterManagedUsage?: boolean
}

const usageLog: AiUsageRecord[] = []

export function recordAiUsage(record: AiUsageRecord): void {
  usageLog.push(record)
  if (usageLog.length > 10_000) {
    usageLog.splice(0, usageLog.length - 10_000)
  }
  if (record.meterManagedUsage === false) return
  recordManagedUsage({
    accountId: record.accountId ?? null,
    userId: record.userId,
    operation: record.operation,
    model: record.model,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens: record.totalTokens,
    status: record.status,
    latencyMs: record.latencyMs,
    requestId: record.requestId,
    plan: record.plan as 'free' | 'trial' | 'pro' | 'anonymous' | undefined,
    mode: record.mode ?? null,
  })
}

export function getUsageRecords(filter?: { userId?: string; operation?: string }): AiUsageRecord[] {
  return usageLog.filter((entry) => {
    if (filter?.userId && entry.userId !== filter.userId) return false
    if (filter?.operation && entry.operation !== filter.operation) return false
    return true
  })
}

export function resetUsageForTests(): void {
  usageLog.length = 0
}

export function summarizeUsage(userId: string): {
  requestCount: number
  successCount: number
  failureCount: number
} {
  const rows = usageLog.filter((entry) => entry.userId === userId)
  return {
    requestCount: rows.length,
    successCount: rows.filter((row) => row.status === 'success').length,
    failureCount: rows.filter((row) => row.status === 'failure').length,
  }
}
