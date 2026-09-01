import type { AiUsageUxState, UsageUxView } from '@flowlary/shared'
import { t } from '../popup/i18n/index.ts'

/** v1 launch locales with complete usage UX copy (others fall back to English from shared). */
export const USAGE_UX_LAUNCH_LOCALES = ['en', 'ar'] as const

const STATE_KEYS: AiUsageUxState[] = [
  'ACCOUNT_REQUIRED',
  'AI_TEMPORARILY_UNAVAILABLE',
  'BILLING_ATTENTION',
  'AI_PRO_SOFT_LIMIT',
  'AI_PRO_ACTIVE',
  'AI_TRIAL_ENDING',
  'AI_TRIAL_ACTIVE',
  'AI_TRIAL_EXPIRED',
  'AI_USAGE_EXHAUSTED',
  'AI_USAGE_LOW',
  'AI_USAGE_HEALTHY',
]

function localizedField(state: AiUsageUxState, field: 'title' | 'description' | 'localTools'): string | null {
  const key = `usageUx.${state}.${field}` as const
  const value = t(key)
  return value === key ? null : value
}

/** Localize shared usage UX copy for popup + dashboard surfaces. */
export function translateUsageUxView(view: UsageUxView): UsageUxView {
  if (!STATE_KEYS.includes(view.state)) return view
  const title = localizedField(view.state, 'title')
  const description = localizedField(view.state, 'description')
  const localTools = view.localToolsNote
    ? localizedField(view.state, 'localTools')
    : null
  return {
    ...view,
    title: title ?? view.title,
    description: description ?? view.description,
    localToolsNote: localTools ?? view.localToolsNote,
  }
}
