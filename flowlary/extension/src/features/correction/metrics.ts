export type CorrectionMetrics = {
  correction_requests: number
  correction_ai_calls: number
  correction_cache_hits: number
  correction_local_hits: number
  correction_stale_results: number
  correction_blocked: number
  correction_errors: number
  correction_commits: number
  correction_card_shown: number
  correction_card_accepted: number
  correction_card_dismissed: number
  correction_card_stale: number
  correction_direct_edit: number
  correction_ui_error: number
}

export function createCorrectionMetrics(): CorrectionMetrics {
  return {
    correction_requests: 0,
    correction_ai_calls: 0,
    correction_cache_hits: 0,
    correction_local_hits: 0,
    correction_stale_results: 0,
    correction_blocked: 0,
    correction_errors: 0,
    correction_commits: 0,
    correction_card_shown: 0,
    correction_card_accepted: 0,
    correction_card_dismissed: 0,
    correction_card_stale: 0,
    correction_direct_edit: 0,
    correction_ui_error: 0,
  }
}
