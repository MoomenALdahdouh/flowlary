import type { CorrectionResponse } from '@flowlary/shared'
import type { CacheCoordinator } from '@flowlary/shared'

export function createCorrectionCache(coordinator: CacheCoordinator) {
  return {
    get(text: string): CorrectionResponse | undefined {
      const entry = coordinator.get<CorrectionResponse>(
        coordinator.buildKey({ operation: 'CORRECT', text }),
      )
      return entry?.value
    },
    set(text: string, value: CorrectionResponse): void {
      coordinator.set(coordinator.buildKey({ operation: 'CORRECT', text }), value)
    },
  }
}
