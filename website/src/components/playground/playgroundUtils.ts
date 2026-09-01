import type { FeatureMode } from './demoData.ts'
import type { Messages } from '../../i18n/en.ts'

const MODES: FeatureMode[] = ['correction', 'translation', 'live', 'layout']

export function playgroundExampleLabel(template: string, index: number): string {
  return template.replace('{n}', String(index + 1))
}

export function playgroundTabLabel(t: Messages, mode: FeatureMode): string {
  return t.playground.tabs[mode]
}

export function playgroundDescription(t: Messages, mode: FeatureMode): string {
  return t.playground.descriptions[mode]
}

export function playgroundCapabilities(t: Messages) {
  return MODES.map((mode, index) => ({
    mode,
    title: t.playground.capabilities[index].title,
    summary: t.playground.capabilities[index].summary,
  }))
}

export function playgroundStatus(t: Messages, key: keyof Messages['playground']['status']): string {
  return t.playground.status[key]
}
