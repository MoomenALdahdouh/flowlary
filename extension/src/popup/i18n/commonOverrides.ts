import type { MessageOverrides } from './types.ts'

type ShellCopy = {
  tagline: string
  home: string
  activity: string
  settings: string
  dashboard: string
  progress: string
  practice: string
  uiLanguage: string
  signIn: string
  signOut: string
  cancel: string
  correction: string
  translation: string
  layout: string
  speedbox: string
  translate: string
  fixLayout: string
  enableAi: string
  aiUnavailable: string
  checking: string
  connected: string
  getStarted: string
  continue: string
  skip: string
  back: string
  welcomeTitle: string
  welcomeLead: string
  readyTitle: string
  readyLead: string
  startWriting: string
  tryHere: string
  run: string
  clear: string
  resultLabel: string
}

export function extensionShellOverrides(copy: ShellCopy): MessageOverrides {
  return {
    brand: { tagline: copy.tagline },
    nav: {
      home: copy.home,
      activity: copy.activity,
      settings: copy.settings,
      dashboard: copy.dashboard,
      progress: copy.progress,
      practice: copy.practice,
    },
    settings: { uiLanguage: copy.uiLanguage },
    compose: {
      title: copy.tryHere,
      run: copy.run,
      clear: copy.clear,
      resultLabel: copy.resultLabel,
      mode: {
        correction: copy.correction,
        translation: copy.translation,
        layout: copy.layout,
        speedbox: copy.speedbox,
      },
    },
    features: {
      correction: copy.correction,
      translation: copy.translation,
      layout: copy.layout,
    },
    actions: {
      translate: copy.translate,
      fixLayout: copy.fixLayout,
    },
    shortcuts: {
      translate: copy.translate,
      fixLayout: copy.fixLayout,
    },
    onboarding: {
      welcomeTitle: copy.welcomeTitle,
      welcomeLead: copy.welcomeLead,
      getStarted: copy.getStarted,
      continue: copy.continue,
      skip: copy.skip,
      back: copy.back,
      readyTitle: copy.readyTitle,
      readyLead: copy.readyLead,
      startWriting: copy.startWriting,
    },
    account: {
      signIn: copy.signIn,
      signOut: copy.signOut,
    },
    dialog: { cancel: copy.cancel },
    connection: {
      checking: copy.checking,
      connected: copy.connected,
    },
    ai: {
      enable: copy.enableAi,
      unavailable: copy.aiUnavailable,
    },
  }
}
