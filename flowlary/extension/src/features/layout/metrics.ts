export type LayoutMetrics = {
  layout_local_hits: number
  layout_cache_hits: number
  layout_classifier_calls: number
  layout_stale_results: number
  layout_blocked: number
}

export function createLayoutMetrics(): LayoutMetrics {
  return {
    layout_local_hits: 0,
    layout_cache_hits: 0,
    layout_classifier_calls: 0,
    layout_stale_results: 0,
    layout_blocked: 0,
  }
}
