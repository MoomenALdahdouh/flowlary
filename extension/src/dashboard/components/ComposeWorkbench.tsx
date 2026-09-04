import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ExtensionStatus } from '../../messaging/types.ts'
import type { DomainState, FeatureStateKind } from '../../ui/domainState.ts'
import { humanizePopupError, accountSync } from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import type { CorrectionResponse } from '@flowlary/shared'
import { DIRECT_HIGHLIGHT_PREVIEW_MS } from '@flowlary/shared'
import { recordCorrectionDetected } from '../../features/learning/recordCorrectionLearning.ts'
import { cancelCorrectionRemote, requestCorrectionRemote } from '../../features/correction/client.ts'
import { buildLocalCorrectionResponse } from '../../features/correction/localSuggestion.ts'
import { requestTranslationRemote } from '../../features/translation/client.ts'
import {
  isAssistCooldownActive,
  noteAssistRateLimited,
} from '../../features/correction/assistCooldown.ts'
import {
  composeCorrectionWaitMs,
  composeTranslationDelayMs,
  shouldScheduleComposeCorrection,
} from '../composeLiveAssist.ts'
import { FeatureModeSwitch } from '../../ui/FeatureModeSwitch.tsx'
import {
  convertManualText,
  defaultConverterPair,
} from '../../features/layout/layouts/convert.ts'
import { toUserLayoutProfile } from '../../features/layout/profile/index.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import { openUpgradePage } from '../../config/upgrade.ts'
import { flowlaryStorage } from '../../storage/index.ts'
import {
  markContextualUpgradePromptShown,
  shouldShowContextualUpgradePrompt,
} from '../../ui/upgradePromptSuppression.ts'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'
import { CorrectionHighlight } from './CorrectionHighlight.tsx'
import { AiErrorRecovery } from '../../ui/AiErrorRecovery.tsx'
import { dispatchCommand } from '../../popup/api.ts'

export type ComposeMode = 'correction' | 'translation' | 'layout'

type ComposePhase = 'idle' | 'working' | 'done' | 'error'

const MODES: ComposeMode[] = ['correction', 'translation', 'layout']

const SAMPLES: Record<ComposeMode, string[]> = {
  correction: [
    'I has been working on this project for three month and I dont know if its ready yet.',
    'I recieved the mesage yesterday',
    'We was planning to send the report tomorow',
  ],
  translation: ['Hello, how are you today?', 'Can you send me the document tomorrow?'],
  layout: ['jkhg ;d hgl,kh', 'lvpfh', 'hgld'],
}

function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.name ?? code.toUpperCase()
}

function modeFeatureKind(mode: ComposeMode, domain: DomainState): FeatureStateKind {
  switch (mode) {
    case 'correction':
      return domain.features.correction.kind
    case 'translation':
      return domain.features.translation.kind
    case 'layout':
      return domain.features.layout.kind
    default:
      return 'unavailable'
  }
}

function modeBlockedMessage(kind: FeatureStateKind): string | null {
  switch (kind) {
    case 'ready':
      return null
    case 'disabled':
      return t('compose.blockedOff')
    case 'paused':
      return t('compose.blockedPaused')
    case 'locked':
      return t('compose.blockedLocked')
    case 'requires_consent':
      return t('compose.blockedConsent')
    case 'requires_auth':
      return t('compose.blockedSignIn')
    case 'unavailable':
      return t('compose.blockedUnavailable')
    default:
      return t('compose.blockedUnavailable')
  }
}

type ComposeWorkbenchProps = {
  status: ExtensionStatus
  domain: DomainState
  onAcceptManaged?: () => void
  onOpenAccount?: () => void
  correctionOnly?: boolean
  onCorrectionModeChange?: (next: 'box' | 'direct') => void
}

export function ComposeWorkbench({
  status,
  domain,
  onAcceptManaged,
  onOpenAccount,
  correctionOnly = false,
  onCorrectionModeChange,
}: ComposeWorkbenchProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<ComposeMode>('correction')
  const heldCorrectionRef = useRef<CorrectionResponse | null>(null)
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<ComposePhase>('idle')
  const [result, setResult] = useState<string | null>(null)
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUpgradeCta, setShowUpgradeCta] = useState(false)
  const usage = resolveUsageUxFromStatus(status)

  const layoutPair = useMemo(() => {
    const profile = toUserLayoutProfile(status.layout.sourceLayout, status.layout.targetLayouts)
    return defaultConverterPair(profile)
  }, [status.layout.sourceLayout, status.layout.targetLayouts])

  const languagePair = `${languageName(status.translation.sourceLanguage)} → ${languageName(status.translation.targetLanguage)}`

  const correctionMode = status.correction.mode
  const translationMode = status.translation.mode
  const layoutMode = status.layout.mode
  const isCorrectionBox = mode === 'correction' && correctionMode === 'box'
  const isCorrectionDirect = mode === 'correction' && correctionMode === 'direct'
  const isTranslationBox = mode === 'translation' && translationMode === 'box'
  const isTranslationDirect = mode === 'translation' && translationMode === 'direct'
  const isLayoutBox = mode === 'layout' && layoutMode === 'box'
  const isLayoutDirect = mode === 'layout' && layoutMode === 'direct'
  const correctionRunRef = useRef(0)
  const correctionRequestIdRef = useRef<string | null>(null)
  const lastCorrectionSentRef = useRef({ text: '', at: 0 })
  const lastTranslationSentRef = useRef({ text: '', at: 0 })
  const translationCooldownUntilRef = useRef(0)
  const translationRunRef = useRef(0)
  const layoutRunRef = useRef(0)

  const blocked = modeBlockedMessage(modeFeatureKind(mode, domain))
  const isCardMode =
    (mode === 'correction' && isCorrectionBox) ||
    (mode === 'translation' && isTranslationBox) ||
    (mode === 'layout' && isLayoutBox)
  const canRun =
    Boolean(input.trim()) &&
    phase !== 'working' &&
    !blocked &&
    isCardMode

  const syncHeight = useCallback(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 260)}px`
  }, [])

  useEffect(() => {
    syncHeight()
  }, [input, syncHeight])

  const resetOutput = useCallback(() => {
    if (phase === 'done' || phase === 'error') {
      setPhase('idle')
      setResult(null)
      setCorrection(null)
      setError(null)
      setShowUpgradeCta(false)
    }
  }, [phase])

  const applySample = useCallback((text: string) => {
    setInput(text)
    setPhase('idle')
    setResult(null)
    setCorrection(null)
    setError(null)
    setShowUpgradeCta(false)
    textareaRef.current?.focus()
  }, [])

  const switchMode = useCallback((next: ComposeMode) => {
    setMode(next)
    setPhase('idle')
    setResult(null)
    setCorrection(null)
    setError(null)
    setShowUpgradeCta(false)
  }, [])

  const maybeOfferUpgrade = useCallback(async (code: string) => {
    const exhausted =
      code === 'usage_exhausted' ||
      code === 'AI_ENTITLEMENT_DENIED' ||
      code === 'entitlement_denied'
    if (!exhausted || usage.state === 'AI_TEMPORARILY_UNAVAILABLE') {
      setShowUpgradeCta(false)
      return
    }
    if (usage.state === 'ACCOUNT_REQUIRED' || !usage.showUpgrade) {
      setShowUpgradeCta(false)
      return
    }
    const allowed = await shouldShowContextualUpgradePrompt(flowlaryStorage)
    if (!allowed) {
      setShowUpgradeCta(false)
      return
    }
    setShowUpgradeCta(true)
    await markContextualUpgradePromptShown(flowlaryStorage)
  }, [usage.showUpgrade, usage.state])

  const runCorrection = useCallback(
    async (trimmed: string, token: number) => {
      if (token !== correctionRunRef.current) return
      const localPreview = buildLocalCorrectionResponse(trimmed)
      if (!(correctionMode === 'box' && localPreview)) {
        setPhase('working')
      }
      setError(null)
      setShowUpgradeCta(false)

      try {
        if (status.account.signedIn) {
          await accountSync()
        }
        if (correctionRequestIdRef.current) {
          void cancelCorrectionRemote(correctionRequestIdRef.current)
        }
        const requestId = crypto.randomUUID()
        correctionRequestIdRef.current = requestId
        lastCorrectionSentRef.current = { text: trimmed, at: Date.now() }
        const response = await requestCorrectionRemote(requestId, trimmed, 'textarea', undefined)
        if (token !== correctionRunRef.current) return
        if (!response.ok) {
          if (response.error === 'rate_limited' || response.error === 'AI_RATE_LIMITED') {
            noteAssistRateLimited()
          }
          const local = buildLocalCorrectionResponse(trimmed)
          if (local && correctionMode === 'box') {
            setCorrection(local)
            setResult(local.correctedText)
            setPhase('done')
            return
          }
          setPhase('error')
          setError(humanizePopupError(response.error))
          await maybeOfferUpgrade(response.error)
          return
        }
        if (response.data.changes.length > 0) {
          recordCorrectionDetected(requestId, trimmed, response.data)
        }
        if (response.data.correctedText === trimmed || response.data.changes.length === 0) {
          const held = heldCorrectionRef.current
          if (held && trimmed === held.correctedText) {
            setCorrection(held)
            setResult(held.correctedText)
            setPhase('done')
            return
          }
          const local = buildLocalCorrectionResponse(trimmed)
          if (local) {
            setCorrection(local)
            setResult(local.correctedText)
            setPhase('done')
            return
          }
          setPhase('idle')
          setResult(null)
          setCorrection(null)
          return
        }
        if (correctionMode === 'direct') {
          if (status.correction.highlights && response.data.changes.length > 0) {
            setResult(response.data.correctedText)
            setCorrection(response.data)
            setPhase('done')
            window.setTimeout(() => {
              if (token !== correctionRunRef.current) return
              setInput(response.data.correctedText)
              setPhase('idle')
              setResult(null)
              setCorrection(null)
            }, DIRECT_HIGHLIGHT_PREVIEW_MS)
            return
          }
          setInput(response.data.correctedText)
          setPhase('idle')
          setResult(null)
          setCorrection(null)
          return
        }
        setResult(response.data.correctedText)
        setCorrection(response.data)
        setPhase('done')
      } catch {
        if (token !== correctionRunRef.current) return
        setPhase('error')
        setError(t('compose.runFailed'))
      }
    },
    [correctionMode, maybeOfferUpgrade, status.account.signedIn, status.correction.highlights],
  )

  const runTranslation = useCallback(
    async (trimmed: string, token: number) => {
      if (token !== translationRunRef.current) return
      setPhase('working')
      setError(null)
      setShowUpgradeCta(false)

      try {
        if (status.account.signedIn) {
          await accountSync()
        }
        lastTranslationSentRef.current = { text: trimmed, at: Date.now() }
        const response = await requestTranslationRemote(
          trimmed,
          status.translation.sourceLanguage,
          status.translation.targetLanguage,
          undefined,
          'shortcut',
        )
        if (token !== translationRunRef.current) return
        if (!response.ok) {
          if (response.code === 'rate_limited' || response.code === 'AI_RATE_LIMITED') {
            translationCooldownUntilRef.current = Date.now() + 60_000
          }
          setPhase('error')
          setError(humanizePopupError(response.code))
          await maybeOfferUpgrade(response.code)
          return
        }
        if (response.translation === trimmed) {
          setPhase('idle')
          setResult(null)
          return
        }
        if (translationMode === 'direct') {
          setInput(response.translation)
          setPhase('idle')
          setResult(null)
          return
        }
        setResult(response.translation)
        setPhase('done')
      } catch {
        if (token !== translationRunRef.current) return
        setPhase('error')
        setError(t('compose.runFailed'))
      }
    },
    [maybeOfferUpgrade, status.account.signedIn, status.translation, translationMode],
  )

  const runLayout = useCallback(
    async (trimmed: string, token: number) => {
      if (token !== layoutRunRef.current) return
      setPhase('working')
      setError(null)
      setShowUpgradeCta(false)

      try {
        const converted = convertManualText(
          trimmed,
          layoutPair.sourceLayout,
          layoutPair.targetLayout,
        )
        if (token !== layoutRunRef.current) return
        if (!converted.ok) {
          setPhase('error')
          setError(t('compose.layoutFailed'))
          return
        }
        if (converted.text === trimmed) {
          setPhase('idle')
          setResult(null)
          return
        }
        if (layoutMode === 'direct') {
          setInput(converted.text)
          setPhase('idle')
          setResult(null)
          return
        }
        setResult(converted.text)
        setPhase('done')
      } catch {
        if (token !== layoutRunRef.current) return
        setPhase('error')
        setError(t('compose.runFailed'))
      }
    },
    [layoutMode, layoutPair.sourceLayout, layoutPair.targetLayout],
  )

  useEffect(() => {
    if (mode !== 'correction' || blocked) return
    const trimmed = input.trim()
    const held = heldCorrectionRef.current
    if (held && trimmed === held.correctedText) {
      setPhase('done')
      setCorrection(held)
      setResult(held.correctedText)
      return
    }
    if (trimmed.length < 2) {
      setPhase('idle')
      setResult(null)
      setCorrection(null)
      return
    }

    const local = correctionMode === 'box' ? buildLocalCorrectionResponse(trimmed) : null
    if (local) {
      setCorrection(local)
      setResult(local.correctedText)
      setPhase('done')
    }

    const last = lastCorrectionSentRef.current
    if (!shouldScheduleComposeCorrection(input, last.text)) {
      return
    }

    const token = ++correctionRunRef.current
    const delay = composeCorrectionWaitMs(input, last.at)
    const timer = window.setTimeout(() => {
      const latest = lastCorrectionSentRef.current
      if (!shouldScheduleComposeCorrection(input, latest.text)) return
      void runCorrection(trimmed, token)
    }, delay)

    return () => {
      window.clearTimeout(timer)
      correctionRunRef.current += 1
      if (correctionRequestIdRef.current) {
        void cancelCorrectionRemote(correctionRequestIdRef.current)
        correctionRequestIdRef.current = null
      }
    }
  }, [blocked, input, mode, runCorrection])

  useEffect(() => {
    if (mode !== 'translation' || blocked) return
    const trimmed = input.trim()
    if (trimmed.length < 2) {
      setPhase('idle')
      setResult(null)
      return
    }
    const now = Date.now()
    if (now < translationCooldownUntilRef.current) return
    if (trimmed === lastTranslationSentRef.current.text) return
    if (now - lastTranslationSentRef.current.at < 2500) return

    const token = ++translationRunRef.current
    const delay = composeTranslationDelayMs(translationMode)
    const timer = window.setTimeout(() => {
      if (Date.now() < translationCooldownUntilRef.current) return
      void runTranslation(trimmed, token)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [blocked, input, mode, runTranslation, translationMode])

  useEffect(() => {
    if (mode !== 'layout' || blocked) return
    const trimmed = input.trim()
    if (trimmed.length < 1) {
      setPhase('idle')
      setResult(null)
      return
    }

    const token = ++layoutRunRef.current
    const delay = layoutMode === 'direct' ? 280 : 360
    const timer = window.setTimeout(() => {
      void runLayout(trimmed, token)
    }, delay)

    return () => {
      window.clearTimeout(timer)
    }
  }, [blocked, input, layoutMode, mode, runLayout])

  const applySuggestion = useCallback(() => {
    if (!result) return
    setInput(result)
    setPhase('idle')
    setResult(null)
    setCorrection(null)
    textareaRef.current?.focus()
  }, [result])

  const applyCorrectionSuggestion = useCallback(() => {
    if (!correction) return
    heldCorrectionRef.current = correction
    setInput(correction.correctedText)
    setResult(correction.correctedText)
    setPhase('done')
    textareaRef.current?.focus()
  }, [correction])

  const run = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || phase === 'working' || blocked) return

    if (mode === 'correction') {
      const token = ++correctionRunRef.current
      await runCorrection(trimmed, token)
      return
    }
    if (!isCardMode) return
    if (mode === 'translation') {
      const token = ++translationRunRef.current
      await runTranslation(trimmed, token)
      return
    }
    if (mode === 'layout') {
      const token = ++layoutRunRef.current
      await runLayout(trimmed, token)
    }
  }, [blocked, input, isCardMode, mode, phase, runCorrection, runLayout, runTranslation])

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      isCardMode &&
      event.key === 'Enter' &&
      !event.shiftKey &&
      phase === 'done' &&
      result
    ) {
      event.preventDefault()
      applySuggestion()
      return
    }
    if (isCardMode && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void run()
    }
  }

  const hint =
    mode === 'correction'
      ? isCorrectionDirect
        ? t('compose.hintCorrectionDirect')
        : t('compose.hintCorrectionCard')
      : mode === 'translation'
        ? isTranslationDirect
          ? t('compose.hintTranslationDirect', { pair: languagePair })
          : t('compose.hintTranslationCard', { pair: languagePair })
        : isLayoutDirect
          ? t('compose.hintLayoutDirect')
          : t('compose.hintLayoutCard')

  const placeholder =
    mode === 'correction'
      ? t('compose.placeholderCorrection')
      : mode === 'translation'
        ? t('compose.placeholderTranslation')
        : t('compose.placeholderLayout')

  const showCorrectionPreview =
    phase === 'done' &&
    Boolean(correction) &&
    (isCorrectionBox || (isCorrectionDirect && status.correction.highlights))

  return (
    <section className="fl-dash-card fl-compose" aria-labelledby="fl-compose-title" data-tour="compose">
      <div className="fl-compose-head">
        <div>
          <h3 id="fl-compose-title" className="fl-section-label">
            {correctionOnly ? t('practice.writeHereTitle') : t('compose.title')}
          </h3>
          <p className="fl-compose-lead">
            {correctionOnly ? t('practice.writeHereLead') : t('compose.lead')}
          </p>
        </div>
      </div>

      {onCorrectionModeChange ? (
        <FeatureModeSwitch
          ariaLabel={t('settings.correctionMode')}
          mode={correctionMode}
          cardDesc={t('settings.boxModeDesc')}
          directDesc={t('settings.directModeDesc')}
          onChange={onCorrectionModeChange}
        />
      ) : null}

      {correctionOnly ? null : (
        <div className="fl-compose-modes" role="tablist" aria-label={t('compose.modesAria')}>
          {MODES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              className={`fl-compose-mode${mode === item ? ' is-active' : ''}`}
              onClick={() => switchMode(item)}
            >
              {t(`compose.mode.${item}`)}
            </button>
          ))}
        </div>
      )}

      <div className="fl-compose-shell">
        <textarea
          ref={textareaRef}
          id="fl-compose-input"
          className="fl-compose-input"
          value={input}
          onChange={(event) => {
            const next = event.target.value
            const held = heldCorrectionRef.current
            if (held && next === held.correctedText) {
              setInput(next)
              return
            }
            heldCorrectionRef.current = null
            const cooling = isAssistCooldownActive() || Date.now() < translationCooldownUntilRef.current
            if (isCardMode) {
              if (!cooling) resetOutput()
            } else if ((phase === 'done' || phase === 'error') && !cooling) {
              setPhase('idle')
              setResult(null)
              setCorrection(null)
              setError(null)
              setShowUpgradeCta(false)
            }
            setInput(next)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          dir={mode === 'layout' ? 'ltr' : undefined}
          spellCheck={mode === 'correction'}
          disabled={phase === 'working' && !isCardMode}
          aria-label={t('compose.inputAria')}
        />

        {phase === 'working' && !isCardMode ? (
          <p className="fl-compose-status" role="status">
            {mode === 'correction' ? t('compose.analyzing') : t('compose.working')}
          </p>
        ) : null}

        {showCorrectionPreview && result ? (
          <button
            type="button"
            className={`fl-box-card${heldCorrectionRef.current ? ' is-applied' : ''}`}
            onClick={isCorrectionBox ? applyCorrectionSuggestion : undefined}
            disabled={!isCorrectionBox}
            aria-live="polite"
          >
            <div className="fl-box-card-header">
              <span className="fl-box-card-badge">
                <span className="fl-box-card-dot" aria-hidden="true" />
                {t('compose.boxBadge.english')}
              </span>
              <span className="fl-box-card-hint">
                {heldCorrectionRef.current ? t('card.applied') : t('card.clickToAccept')}
              </span>
            </div>
            <CorrectionHighlight
              className="fl-box-card-text"
              original={correction?.originalText ?? ''}
              corrected={correction?.correctedText ?? result}
              changes={correction?.changes ?? []}
            />
          </button>
        ) : null}

        {phase === 'done' && result && (isTranslationBox || isLayoutBox) ? (
          <button
            type="button"
            className="fl-box-card"
            onClick={applySuggestion}
            aria-live="polite"
          >
            <div className="fl-box-card-header">
              <span className="fl-box-card-badge">
                <span className="fl-box-card-dot" aria-hidden="true" />
                {isTranslationBox ? t('compose.boxBadge.translation') : t('compose.boxBadge.typing')}
              </span>
              <span className="fl-box-card-hint">{t('card.clickToAccept')}</span>
            </div>
            <p className="fl-box-card-text">{result}</p>
          </button>
        ) : null}

        {phase === 'error' && error ? (
          <div className="fl-compose-error" role="status">
            <p>{error}</p>
            <AiErrorRecovery
              onRetry={() => void run()}
              onTryLayout={
                mode !== 'layout'
                  ? () => {
                      void dispatchCommand('FIX_LAYOUT').catch(() => undefined)
                    }
                  : undefined
              }
            />
            {showUpgradeCta ? (
              <button type="button" className="fl-action-btn fl-action-btn-primary fl-action-btn-compact" onClick={() => openUpgradePage()}>
                {t('usageCard.upgrade')}
              </button>
            ) : null}
            {mode === 'correction' && domain.features.correction.kind === 'requires_auth' && onOpenAccount ? (
              <button type="button" className="fl-link-btn" onClick={onOpenAccount}>
                {t('account.signIn')}
              </button>
            ) : null}
            {mode === 'correction' && domain.features.correction.kind === 'requires_consent' && onAcceptManaged ? (
              <button type="button" className="fl-link-btn" onClick={onAcceptManaged}>
                {t('ai.enable')}
              </button>
            ) : null}
          </div>
        ) : null}

        {blocked && phase !== 'working' ? (
          <p className="fl-compose-blocked">{blocked}</p>
        ) : null}

        <div className="fl-compose-actions">
          {isCardMode ? (
            <button
              type="button"
              className="fl-action-btn fl-action-btn-primary fl-compose-run"
              onClick={() => void run()}
              disabled={!canRun}
            >
              {phase === 'working' ? t('compose.working') : t('compose.run')}
            </button>
          ) : null}
          {input ? (
            <button
              type="button"
              className="fl-link-btn fl-compose-clear"
              onClick={() => {
                setInput('')
                setPhase('idle')
                setResult(null)
                setCorrection(null)
                setError(null)
              }}
              disabled={phase === 'working'}
            >
              {t('compose.clear')}
            </button>
          ) : null}
        </div>
      </div>

      <p className="fl-compose-hint">{hint}</p>

      <div className="fl-compose-prompts" role="group" aria-label={t('compose.samplesAria')}>
        {SAMPLES[mode].map((sample) => (
          <button
            key={sample}
            type="button"
            className="fl-compose-prompt"
            onClick={() => applySample(sample)}
            disabled={phase === 'working'}
          >
            {sample.length > 46 ? `${sample.slice(0, 45).trimEnd()}…` : sample}
          </button>
        ))}
      </div>
    </section>
  )
}
