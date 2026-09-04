export type DashboardSection =
  | 'overview'
  | 'lab'
  | 'practice'
  | 'progress'
  | 'report'
  | 'account'
  | 'settings'

export const DASHBOARD_SECTIONS: { id: DashboardSection; labelKey: keyof DashboardCopy['nav'] }[] = [
  { id: 'overview', labelKey: 'overview' },
  { id: 'lab', labelKey: 'writingLab' },
  { id: 'practice', labelKey: 'practice' },
  { id: 'progress', labelKey: 'progress' },
  { id: 'report', labelKey: 'report' },
  { id: 'settings', labelKey: 'settings' },
  { id: 'account', labelKey: 'account' },
]

export const DASHBOARD_NAV_GROUPS: {
  labelKey: keyof DashboardCopy['nav']
  items: { id: DashboardSection | 'support' | 'lab'; labelKey: keyof DashboardCopy['nav']; route?: string }[]
}[] = [
  {
    labelKey: 'groupWrite',
    items: [
      { id: 'overview', labelKey: 'overview' },
      { id: 'lab', labelKey: 'writingLab' },
    ],
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
      { id: 'support', labelKey: 'support', route: '/dashboard/support' },
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
    support: string
    writingLab: string
  }
  shell: {
    navAria: string
    signOut: string
    writingLab: string
  }
  connection: {
    checking: string
    connected: string
    disconnected: string
    notInstalled: string
  }
  learningLoop: {
    aria: string
    steps: { title: string; body: string }[]
  }
  overview: {
    title: string
    welcome: string
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
    historyTitle: string
    historyBody: string
    historyAction: string
    planUsage: string
    creditsRemaining: string
    layoutNote: string
    connectedBadge: string
    writingEvents: string
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
    chartAll: string
    chartRate: string
    chartByType: string
    chartEmpty: string
    viewList: string
    viewByType: string
    mistakesLogged: string
    wordsInRange: string
    needsPractice: string
    needsPracticeVsLast: string
    improvingVsLast: string
    steadyVsLast: string
    focusTitle: string
    focusBody: string
    focusSteady: string
    focusImproving: string
    focusRising: string
    topPhrase: string
    tipSpelling: string
    tipGrammar: string
    tipWording: string
    suggested: string
    applied: string
    appliedCount: string
    listen: string
    openHistory: string
    repeatsNote: string
    filterAll: string
    recent: string
    practiceCta: string
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
    aiInterpretation: string
    observedData: string
    failed: string
  }
  settings: {
    title: string
    lead: string
    writingToolsNote: string
    learningProfile: string
    profileHint: string
    level: string
    levelHint: string
    levelUnset: string
    levels: {
      beginner: string
      elementary: string
      intermediate: string
      upper_intermediate: string
      advanced: string
    }
    focusAreas: string
    focusHint: string
    focusSpellingHint: string
    focusGrammarHint: string
    focusWordingHint: string
    save: string
    saved: string
    unsaved: string
    clearLocal: string
    clearLocalConfirm: string
    clearHint: string
    dataTitle: string
    exportData: string
    importData: string
    exportHint: string
    importHint: string
    exportReady: string
    importReady: string
    importInvalid: string
    replaceProfile: string
    exportImportNote: string
    dangerTitle: string
    dangerLead: string
    resetProfile: string
    resetHint: string
    resetConfirm: string
  }
  coach: {
    title: string
    ask: string
    sending: string
    presetFocus: string
    presetProgress: string
    presetReport: string
    aiInterpretation: string
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
    id === 'lab' ||
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
