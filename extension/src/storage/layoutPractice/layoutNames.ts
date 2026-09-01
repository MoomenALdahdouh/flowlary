import { getSupportedLayouts, isSupportedLayout } from '../../features/layout/layouts/registry.ts'

export function layoutDisplayName(layoutId: string): string {
  if (!isSupportedLayout(layoutId)) return layoutId
  return getSupportedLayouts().find((layout) => layout.id === layoutId)?.name ?? layoutId
}
