export type AiUsageRecord = {
  requestId: string
  userId: string
  operation: 'correction' | 'translation' | 'layout-classification'
  model: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  status: 'success' | 'failure'
  latencyMs: number
  createdAt: number
  entitlement?: string
}

const usageLog: AiUsageRecord[] = []

export function recordAiUsage(record: AiUsageRecord): void {
  usageLog.push(record)
  if (usageLog.length > 10_000) {
    usageLog.splice(0, usageLog.length - 10_000)
  }
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
