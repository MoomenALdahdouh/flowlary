import { flowlaryStorage } from '../index.ts'
import { getHistoryService } from './service.ts'
import type { HistoryRecordInput } from './types.ts'

export async function recordHistory(input: HistoryRecordInput): Promise<boolean> {
  const service = getHistoryService(flowlaryStorage)
  await service.initialize()
  return service.record(input)
}

export async function ensureHistoryInitialized(): Promise<void> {
  const service = getHistoryService(flowlaryStorage)
  await service.initialize()
}
