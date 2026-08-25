import type { FlowlaryStorage } from '../index.ts'
import type { HistoryEntry, HistoryRecordInput, HistoryStats, HistoryStoreV1 } from './types.ts'
import { HISTORY_STORE_VERSION, MAX_HISTORY_ENTRIES } from './types.ts'
import { isDuplicateHistoryEntry } from './dedupe.ts'
import { extractLegacyPreserve, importLegacyHistoryArrays } from './legacyImport.ts'
import {
  canRecordHistory,
  fieldKindFromElement,
  normalizeHistoryDomain,
} from './privacy.ts'
import {
  normalizeHistoryStore,
  pruneHistoryEntries,
  sanitizeHistoryEntry,
  sortHistoryEntries,
} from './validation.ts'
import { stateManager } from '../../core/state/StateManager.ts'

let sequence = 0

function createHistoryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  sequence += 1
  return `${Date.now()}-${sequence}`
}

export class HistoryService {
  private writeChain: Promise<void> = Promise.resolve()

  constructor(private storage: FlowlaryStorage) {}

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn)
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  private async readStore(): Promise<HistoryStoreV1> {
    const raw = await this.storage.get(this.storage.keys.history, 'local')
    return normalizeHistoryStore(raw)
  }

  private async writeStore(store: HistoryStoreV1): Promise<void> {
    const raw = await this.storage.get(this.storage.keys.history, 'local')
    const legacy = extractLegacyPreserve(raw)
    const payload: Record<string, unknown> = {
      ...store,
      _v: 1,
    }
    if (legacy.ewa?.length) payload.ewa = legacy.ewa
    if (legacy.layfix?.length) payload.layfix = legacy.layfix
    await this.storage.set(this.storage.keys.history, payload, 'local')
  }

  async initialize(): Promise<void> {
    await this.enqueue(async () => {
      const raw = await this.storage.get(this.storage.keys.history, 'local')
      let store = normalizeHistoryStore(raw)

      if (!store.legacyImported) {
        const legacy = extractLegacyPreserve(raw)
        const hasLegacy = (legacy.ewa?.length ?? 0) > 0 || (legacy.layfix?.length ?? 0) > 0
        if (hasLegacy) {
          const imported = importLegacyHistoryArrays(legacy)
          const merged = sortHistoryEntries([...store.entries, ...imported])
          const deduped: HistoryEntry[] = []
          for (const entry of merged) {
            if (isDuplicateHistoryEntry(deduped, entry, Number.MAX_SAFE_INTEGER)) continue
            deduped.push(entry)
          }
          store = {
            version: HISTORY_STORE_VERSION,
            entries: pruneHistoryEntries(deduped),
            legacyImported: true,
          }
          await this.writeStore(store)
        }
      }
    })
  }

  async list(): Promise<HistoryEntry[]> {
    const store = await this.readStore()
    return sortHistoryEntries(store.entries)
  }

  async getStats(): Promise<HistoryStats> {
    const entries = await this.list()
    const byOperation: HistoryStats['byOperation'] = {
      CORRECT: 0,
      TRANSLATE: 0,
      FIX_LAYOUT: 0,
    }
    for (const entry of entries) {
      byOperation[entry.operation] += 1
    }
    return { total: entries.length, byOperation }
  }

  async record(input: HistoryRecordInput): Promise<boolean> {
    return this.enqueue(async () => {
      try {
        const hostname = typeof location !== 'undefined' ? location.hostname : undefined
        const sourceText = input.sourceText.trim()
        const resultText = input.resultText.trim()
        if (!sourceText || !resultText || sourceText === resultText) return false

        if (
          !canRecordHistory({
            element: input.element,
            hostname,
            excludedDomains: stateManager.settings.excludedDomains,
            sourceText,
            resultText,
          })
        ) {
          return false
        }

        const candidate = sanitizeHistoryEntry({
          id: createHistoryId(),
          operation: input.operation,
          timestamp: input.timestamp ?? Date.now(),
          domain: normalizeHistoryDomain(hostname),
          fieldKind: fieldKindFromElement(input.element),
          sourceText,
          resultText,
          metadata: {
            ...input.metadata,
            mode: input.mode ?? input.metadata?.mode,
          },
        })
        if (!candidate) return false

        const store = await this.readStore()
        if (isDuplicateHistoryEntry(store.entries, candidate)) return false

        const next: HistoryStoreV1 = {
          version: HISTORY_STORE_VERSION,
          entries: pruneHistoryEntries([candidate, ...store.entries]),
          legacyImported: store.legacyImported ?? true,
        }
        await this.writeStore(next)
        return true
      } catch {
        return false
      }
    })
  }

  async remove(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const store = await this.readStore()
      const nextEntries = store.entries.filter((entry) => entry.id !== id)
      if (nextEntries.length === store.entries.length) return false
      await this.writeStore({ ...store, entries: nextEntries })
      return true
    })
  }

  async clear(): Promise<void> {
    await this.enqueue(async () => {
      await this.writeStore({
        version: HISTORY_STORE_VERSION,
        entries: [],
        legacyImported: true,
      })
    })
  }
}

let singleton: HistoryService | null = null

export function getHistoryService(storage: FlowlaryStorage): HistoryService {
  if (!singleton) singleton = new HistoryService(storage)
  return singleton
}

export function resetHistoryServiceForTests(): void {
  singleton = null
  sequence = 0
}