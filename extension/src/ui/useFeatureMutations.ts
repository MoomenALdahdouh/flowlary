import { useCallback } from 'react'
import type { ExtensionStatus } from '../messaging/types.ts'
import {
  acceptFlowlaryAi,
  dispatchCommand,
  fetchStatus,
  patchCorrection,
  patchLayout,
  patchTranslation,
  patchSettings,
  patchWritingPolicy,
  setGlobalActive,
} from '../popup/api.ts'
import { withHostExclusion } from '../core/safety/domains.ts'

type Session = {
  status: ExtensionStatus | null
  setStatus: (status: ExtensionStatus | null) => void
  mutate: (
    key: string,
    fn: () => Promise<ExtensionStatus>,
    rollback?: () => void,
  ) => Promise<void>
}

export function useFeatureMutations({ status, setStatus, mutate }: Session) {
  const onGlobalToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prev = status.active
      setStatus({ ...status, active: next })
      void mutate(
        'global',
        () => setGlobalActive(next),
        () => setStatus({ ...status, active: prev }),
      )
    },
    [mutate, setStatus, status],
  )

  const onCorrectionToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prev = status.correction.enabled
      setStatus({ ...status, correction: { ...status.correction, enabled: next } })
      void mutate(
        'correction',
        () => patchWritingPolicy({ improveEnglish: next }),
        () => setStatus({ ...status, correction: { ...status.correction, enabled: prev } }),
      )
    },
    [mutate, setStatus, status],
  )

  const onCorrectionModeChange = useCallback(
    (next: 'box' | 'direct') => {
      if (!status) return
      const prev = status.correction.mode
      setStatus({ ...status, correction: { ...status.correction, mode: next } })
      void mutate(
        'correction-mode',
        () => patchCorrection({ mode: next }),
        () => setStatus({ ...status, correction: { ...status.correction, mode: prev } }),
      )
    },
    [mutate, setStatus, status],
  )

  const onTranslationToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prevShortcut = status.translation.shortcutEnabled
      const prevLive = status.translation.liveEnabled
      setStatus({
        ...status,
        translation: {
          ...status.translation,
          shortcutEnabled: next,
          liveEnabled: next ? status.translation.liveEnabled : false,
        },
      })
      void mutate(
        'translation',
        () =>
          patchWritingPolicy({
            arabicToEnglishMode: next ? status.translation.liveEnabled : false,
          }).then(() =>
            patchTranslation({
              shortcutEnabled: next,
              liveEnabled: next ? status.translation.liveEnabled : false,
            }),
          ),
        () =>
          setStatus({
            ...status,
            translation: {
              ...status.translation,
              shortcutEnabled: prevShortcut,
              liveEnabled: prevLive,
            },
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onTranslationModeChange = useCallback(
    (next: 'box' | 'direct') => {
      if (!status) return
      const prevMode = status.translation.mode
      const prevLive = status.translation.liveEnabled
      const nextLive = next === 'direct' ? status.translation.liveEnabled : false
      setStatus({
        ...status,
        translation: {
          ...status.translation,
          mode: next,
          liveEnabled: nextLive,
        },
      })
      void mutate(
        'translation-mode',
        () =>
          patchTranslation({
            mode: next,
            liveEnabled: nextLive,
          }),
        () =>
          setStatus({
            ...status,
            translation: {
              ...status.translation,
              mode: prevMode,
              liveEnabled: prevLive,
            },
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onLayoutModeChange = useCallback(
    (next: 'box' | 'direct') => {
      if (!status) return
      const prev = status.layout.mode
      setStatus({ ...status, layout: { ...status.layout, mode: next } })
      void mutate(
        'layout-mode',
        () => patchLayout({ mode: next }),
        () => setStatus({ ...status, layout: { ...status.layout, mode: prev } }),
      )
    },
    [mutate, setStatus, status],
  )

  const onLiveToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prev = status.translation.liveEnabled
      setStatus({
        ...status,
        translation: { ...status.translation, liveEnabled: next },
      })
      void mutate(
        'live',
        () => patchWritingPolicy({ arabicToEnglishMode: next }),
        () =>
          setStatus({
            ...status,
            translation: { ...status.translation, liveEnabled: prev },
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onLayoutToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prev = status.layout.autoEnabled
      setStatus({ ...status, layout: { ...status.layout, autoEnabled: next } })
      void mutate(
        'layout',
        () => patchWritingPolicy({ fixWrongTyping: next }),
        () => setStatus({ ...status, layout: { ...status.layout, autoEnabled: prev } }),
      )
    },
    [mutate, setStatus, status],
  )

  const onHelpStyleChange = useCallback(
    (next: 'auto' | 'suggestions' | 'shortcuts_only') => {
      if (!status) return
      const prev = status.writingPolicy?.helpStyle
      setStatus({
        ...status,
        writingPolicy: {
          helpStyle: next,
          fixWrongTyping: status.writingPolicy?.fixWrongTyping ?? status.layout.autoEnabled,
          improveEnglish: status.writingPolicy?.improveEnglish ?? status.correction.enabled,
          arabicToEnglishMode:
            status.writingPolicy?.arabicToEnglishMode ?? status.translation.liveEnabled,
          polishAfterTranslate: status.writingPolicy?.polishAfterTranslate ?? false,
          aiAdvisorEnabled: status.writingPolicy?.aiAdvisorEnabled !== false,
          aiWritingReviewEnabled: status.writingPolicy?.aiWritingReviewEnabled !== false,
          operatingState:
            next === 'shortcuts_only'
              ? 'manual'
              : status.translation.liveEnabled
                ? 'translation'
                : 'normal',
        },
      })
      void mutate(
        'help-style',
        () => patchWritingPolicy({ helpStyle: next }),
        () =>
          setStatus({
            ...status,
            writingPolicy: prev
              ? { ...status.writingPolicy!, helpStyle: prev }
              : status.writingPolicy,
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onSiteExcludedChange = useCallback(
    (next: boolean) => {
      if (!status?.pageHostname) return
      const prevExcluded = [...(status.excludedDomains ?? [])]
      const excludedDomains = withHostExclusion(prevExcluded, status.pageHostname, next)
      setStatus({
        ...status,
        excludedDomains,
        pageExcluded: next,
      })
      void mutate(
        'site',
        () => patchSettings({ excludedDomains }),
        () =>
          setStatus({
            ...status,
            excludedDomains: prevExcluded,
            pageExcluded: status.pageExcluded,
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onAiAdvisorToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prev = status.writingPolicy?.aiAdvisorEnabled !== false
      setStatus({
        ...status,
        writingPolicy: status.writingPolicy
          ? { ...status.writingPolicy, aiAdvisorEnabled: next }
          : {
              helpStyle: 'auto',
              fixWrongTyping: status.layout.autoEnabled,
              improveEnglish: status.correction.enabled,
              arabicToEnglishMode: status.translation.liveEnabled,
              polishAfterTranslate: false,
              aiAdvisorEnabled: next,
              aiWritingReviewEnabled: true,
              operatingState: 'normal',
            },
      })
      void mutate(
        'ai-advisor',
        () => patchWritingPolicy({ aiAdvisorEnabled: next }),
        () =>
          setStatus({
            ...status,
            writingPolicy: status.writingPolicy
              ? { ...status.writingPolicy, aiAdvisorEnabled: prev }
              : status.writingPolicy,
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onWritingReviewToggle = useCallback(
    (next: boolean) => {
      if (!status) return
      const prev = status.writingPolicy?.aiWritingReviewEnabled !== false
      setStatus({
        ...status,
        writingPolicy: status.writingPolicy
          ? { ...status.writingPolicy, aiWritingReviewEnabled: next }
          : {
              helpStyle: 'auto',
              fixWrongTyping: status.layout.autoEnabled,
              improveEnglish: status.correction.enabled,
              arabicToEnglishMode: status.translation.liveEnabled,
              polishAfterTranslate: false,
              aiAdvisorEnabled: true,
              aiWritingReviewEnabled: next,
              operatingState: 'normal',
            },
      })
      void mutate(
        'writing-review',
        () => patchWritingPolicy({ aiWritingReviewEnabled: next }),
        () =>
          setStatus({
            ...status,
            writingPolicy: status.writingPolicy
              ? { ...status.writingPolicy, aiWritingReviewEnabled: prev }
              : status.writingPolicy,
          }),
      )
    },
    [mutate, setStatus, status],
  )

  const onAcceptManaged = useCallback(() => {
    void mutate('consent', () => acceptFlowlaryAi())
  }, [mutate])

  const onDispatchCorrect = useCallback(() => {
    void mutate('cmd-correct', () => dispatchCommand('CORRECT').then(() => fetchStatus()))
  }, [mutate])

  const onDispatchTranslate = useCallback(() => {
    void mutate('cmd-translate', () => dispatchCommand('TRANSLATE').then(() => fetchStatus()))
  }, [mutate])

  const onDispatchLayout = useCallback(() => {
    void mutate('cmd-layout', () => dispatchCommand('FIX_LAYOUT').then(() => fetchStatus()))
  }, [mutate])

  return {
    onGlobalToggle,
    onCorrectionToggle,
    onCorrectionModeChange,
    onTranslationModeChange,
    onLayoutModeChange,
    onTranslationToggle,
    onLiveToggle,
    onLayoutToggle,
    onHelpStyleChange,
    onSiteExcludedChange,
    onAiAdvisorToggle,
    onWritingReviewToggle,
    onAcceptManaged,
    onDispatchCorrect,
    onDispatchTranslate,
    onDispatchLayout,
  }
}
