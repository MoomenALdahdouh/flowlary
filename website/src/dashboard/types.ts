export type DashboardSection =
  | 'overview'
  | 'practice'
  | 'progress'
  | 'report'
  | 'account'
  | 'settings'

export const DASHBOARD_SECTIONS: { id: DashboardSection; labelKey: keyof DashboardCopy['nav'] }[] = [
  { id: 'overview', labelKey: 'overview' },
  { id: 'practice', labelKey: 'practice' },
  { id: 'progress', labelKey: 'progress' },
  { id: 'report', labelKey: 'report' },
  { id: 'settings', labelKey: 'settings' },
  { id: 'account', labelKey: 'account' },
]

export const DASHBOARD_NAV_GROUPS: {
  labelKey: keyof DashboardCopy['nav']
  items: { id: DashboardSection; labelKey: keyof DashboardCopy['nav'] }[]
}[] = [
  {
    labelKey: 'groupWrite',
    items: [{ id: 'overview', labelKey: 'overview' }],
  },
  {
    labelKey: 'groupLearn',
    items: [
      { id: 'practice', labelKey: 'practice' },
      { id: 'progress', labelKey: 'progress' },
      { id: 'report', labelKey: 'report' },
    ],
  },
  {
    labelKey: 'groupAccount',
    items: [
      { id: 'settings', labelKey: 'settings' },
      { id: 'account', labelKey: 'account' },
    ],
  },
]

export type DashboardCopy = {
  nav: {
    groupWrite: string
    groupLearn: string
    groupAccount: string
    overview: string
    practice: string
    progress: string
    report: string
    settings: string
    account: string
  }
  overview: {
    title: string
    lead: string
    journey: string
    dailyBrief: string
    coach: string
    writingLab: string
    writingLabBody: string
    startWriting: string
    eventsSynced: string
    extension: string
    extensionConnected: string
    extensionNotDetected: string
  }
  practice: {
    title: string
    lead: string
    home: string
    startSession: string
    focusRecommended: string
    focusSpelling: string
    focusGrammar: string
    focusWording: string
    emerging: string
    none: string
    check: string
    checking: string
    accept: string
    reject: string
    next: string
    complete: string
    sessionComplete: string
    creditsExhausted: string
    noIssues: string
    loading: string
    itemOf: string
  }
  progress: {
    title: string
    lead: string
    wordsWritten: string
    uniqueErrors: string
    errorsPer100: string
    trend: string
    trendImproved: string
    trendIncreased: string
    trendFlat: string
    trendInsufficient: string
    buildingTitle: string
    buildingBody: string
    recurring: string
    clearHistory: string
    clearConfirm: string
    loading: string
    chart7d: string
    chart30d: string
  }
  report: {
    title: string
    lead: string
    loading: string
    empty: string
    overview: string
    strengths: string
    focusAreas: string
    improvements: string
    recommendations: string
    nextSteps: string
    practiceThis: string
    limitReached: string
    proAi: string
  }
  settings: {
    title: string
    lead: string
    learningProfile: string
    level: string
    focusAreas: string
    save: string
    saved: string
    clearLocal: string
    clearLocalConfirm: string
    exportData: string
    importData: string
    exportReady: string
    importReady: string
    importInvalid: string
    replaceProfile: string
    exportImportNote: string
    resetProfile: string
  }
  coach: {
    title: string
    ask: string
    sending: string
    presetFocus: string
    presetProgress: string
    presetReport: string
  }
  brief: {
    loading: string
    empty: string
    insufficient: string
    practiceThis: string
    viewProgress: string
    keepWriting: string
    patternSummary: string
    focusSummary: string
  }
  common: {
    retry: string
    loading: string
    error: string
  }
}

export function parseDashboardSection(hash: string): DashboardSection {
  const id = hash.replace(/^#/, '').split('?')[0] ?? ''
  if (
    id === 'overview' ||
    id === 'practice' ||
    id === 'progress' ||
    id === 'report' ||
    id === 'settings' ||
    id === 'account'
  ) {
    return id
  }
  return 'overview'
}

export function parsePracticeTarget(hash: string): string | undefined {
  const raw = hash.replace(/^#/, '')
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  if (!query) return undefined
  return new URLSearchParams(query).get('target')?.trim() || undefined
}
