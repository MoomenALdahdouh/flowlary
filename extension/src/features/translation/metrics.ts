export type TranslationMetrics = {
  translation_live_events: number
  translation_live_debounced: number
  translation_live_requests: number
  translation_live_cache_hits: number
  translation_live_aborts: number
  translation_live_stale: number
  translation_live_blocked: number
  translation_live_commits: number
  translation_live_errors: number
}

export function createTranslationMetrics(): TranslationMetrics {
  return {
    translation_live_events: 0,
    translation_live_debounced: 0,
    translation_live_requests: 0,
    translation_live_cache_hits: 0,
    translation_live_aborts: 0,
    translation_live_stale: 0,
    translation_live_blocked: 0,
    translation_live_commits: 0,
    translation_live_errors: 0,
  }
}
