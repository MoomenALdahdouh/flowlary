import type { ExtensionStatus } from '../messaging/types.ts'

export type FeatureReadiness = 'ready' | 'disabled' | 'setup' | 'paused' | 'unavailable'

export type PopupFeatureStatus = {
  correction: FeatureReadiness
  translation: FeatureReadiness
  layout: FeatureReadiness
  summary: string
  summaryTone: 'ok' | 'warn' | 'muted'
}

export function languageLabel(code: string, name: string): string {
  return name || code.toUpperCase()
}

export function formatLanguagePair(source: string, target: string, sourceName: string, targetName: string): string {
  return `${languageLabel(source, sourceName)} → ${languageLabel(target, targetName)}`
}

export function computeFeatureStatus(status: ExtensionStatus | null): PopupFeatureStatus {
  if (!status) {
    return {
      correction: 'unavailable',
      translation: 'unavailable',
      layout: 'unavailable',
      summary: 'Loading…',
      summaryTone: 'muted',
    }
  }

  if (!status.active) {
    return {
      correction: 'paused',
      translation: 'paused',
      layout: 'paused',
      summary: 'Flowlary is paused',
      summaryTone: 'muted',
    }
  }

  let correction: FeatureReadiness = 'ready'
  if (!status.correction.enabled) {
    correction = 'disabled'
  } else if (!status.correction.hasGroqKey || !status.correction.consentAccepted) {
    correction = 'setup'
  }

  let translation: FeatureReadiness = 'ready'
  if (!status.translation.shortcutEnabled) {
    translation = 'disabled'
  }

  let layout: FeatureReadiness = status.layout.autoEnabled ? 'ready' : 'disabled'

  let summary = 'Flowlary is active'
  let summaryTone: PopupFeatureStatus['summaryTone'] = 'ok'
  if (correction === 'setup') {
    summary = 'Writing Correction needs setup'
    summaryTone = 'warn'
  } else if (correction === 'disabled' && translation === 'disabled' && layout === 'disabled') {
    summary = 'All features are off'
    summaryTone = 'muted'
  }

  return { correction, translation, layout, summary, summaryTone }
}

export function readinessLabel(state: FeatureReadiness): string {
  switch (state) {
    case 'ready':
      return 'Ready'
    case 'disabled':
      return 'Off'
    case 'setup':
      return 'Setup required'
    case 'paused':
      return 'Paused'
    default:
      return 'Unavailable'
  }
}

export function groqKeyLabel(hasKey: boolean): string {
  return hasKey ? 'Connected' : 'Not configured'
}
