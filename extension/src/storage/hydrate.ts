import { applyUserPolicyToMemory, resolveWritingPolicy } from '../core/policy/writingPolicy.ts'
import { stateManager } from '../core/state/StateManager.ts'
import { toUserLayoutProfile, applyLayoutProfileToMemory } from '../features/layout/profile/index.ts'
import {
  getCorrectionSettings,
  getEntitlementPublicView,
  getLayoutProfile,
  getLayoutSettings,
  getSettings,
  getTranslationSettings,
} from './facade.ts'
import type { FlowlaryStorage } from './index.ts'

export async function hydrateStateFromStorage(storage: FlowlaryStorage): Promise<void> {
  const [settings, correction, translation, layout, profile] = await Promise.all([
    getSettings(storage),
    getCorrectionSettings(storage),
    getTranslationSettings(storage),
    getLayoutSettings(storage),
    getLayoutProfile(storage),
  ])

  Object.assign(stateManager.settings, settings)
  Object.assign(stateManager.correction, correction)
  Object.assign(stateManager.translation, translation)
  Object.assign(stateManager.layout, layout)

  if (profile.layoutProfile.sourceLayout) {
    stateManager.layout.sourceLayout = profile.layoutProfile.sourceLayout
    const targets = profile.layoutProfile.enabledLayouts.filter(
      (id) => id !== profile.layoutProfile.sourceLayout,
    )
    if (targets.length > 0) {
      stateManager.layout.targetLayouts = targets
    }
  } else if (layout.sourceLayout) {
    toUserLayoutProfile(layout.sourceLayout, layout.targetLayouts)
  }

  applyLayoutProfileToMemory(profile)
  applyUserPolicyToMemory(resolveWritingPolicy())
}

export async function getHydratedEntitlementView(storage: FlowlaryStorage) {
  return getEntitlementPublicView(storage)
}
