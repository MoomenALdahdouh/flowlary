export const FLOWLARY_EXPORT_SCHEMA_VERSION = 1

export type FlowlaryExportPayloadV1 = {
  schemaVersion: typeof FLOWLARY_EXPORT_SCHEMA_VERSION
  product: 'flowlary'
  exportedAt: string
  data: {
    settings?: Record<string, unknown>
    correction?: Record<string, unknown>
    translation?: Record<string, unknown>
    layout?: Record<string, unknown>
    learningProfile?: Record<string, unknown>
    learningEvents?: { events: unknown[]; samples: unknown[] }
    practiceSessions?: { sessions: unknown[] }
    activity?: { entries: unknown[] }
  }
}

export type DataImportPreview = {
  schemaVersion: number
  profileCount: number
  learningEventCount: number
  practiceSessionCount: number
  activityCount: number
  hasSettings: boolean
}

export type DataSummary = {
  activityCount: number
  learningEventCount: number
  practiceSessionCount: number
  profileConfigured: boolean
  onboardingCompleted: boolean
}
