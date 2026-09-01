import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  resolveLocalizedPresentation,
  type CorrectionChange,
  type CorrectionResponse,
  type RuleExplanation,
} from '@flowlary/shared'
import {
  requestWebCorrection,
  WEB_CORRECTION_MAX_CHARS,
  WEB_CORRECTION_MIN_CHARS,
  WEB_CORRECTION_MIN_WORDS,
} from '../account/aiClient.ts'
import { acceptWebAiConsent, readWebAiConsent } from '../account/consent.ts'
import {
  loadWebAccount,
  probePublicApi,
  type WebAccountView,
  type WebEntitlementView,
} from '../account/client.ts'
import { Button, GetFlowlaryButton } from '../components/Ui.tsx'
import { useMessages, useI18n } from '../i18n/index.tsx'
import { readWebLearningStore } from './webLearningStore.ts'
import {
  bootstrapWebLearningSync,
  fetchCanonicalLearningEvents,
  syncWritingLabCorrection,
  type LearningSyncStatus,
} from './webLearningSync.ts'
import {
  findRecurringForChange,
  practiceTargetIdForPattern,
  summarizeWebLearning,
  type WebRecurringPattern,
} from './webLearningInsights.ts'
import { probeExtensionBridge, publishOpenDashboard } from '../account/extensionBridge.ts'
import { resolveWritingLabGate, validateWritingLabInput } from './writingLabState.ts'
import { mergeLayoutAndCorrection, repairKeyboardLayoutLocally } from './localLayoutRepair.ts'

type LabPhase = 'idle' | 'working' | 'done' | 'error'

function categoryLabel(
  type: CorrectionChange['type'],
  labels: ReturnType<typeof useMessages>['writingLab']['categories'],
): string {
  if (type === 'spelling') return labels.spelling
  if (type === 'grammar') return labels.grammar
  if (type === 'wording') return labels.wording
  return labels.layout
}

function createBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wl-${Date.now()}`
}

export function WritingLab() {
  const t = useMessages()
  const copy = t.writingLab
  const { locale } = useI18n()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestSeqRef = useRef(0)
  const accountSnapshotRef = useRef<string | null>(null)

  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<LabPhase>('idle')
  const [response, setResponse] = useState<CorrectionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const [account, setAccount] = useState<WebAccountView | null>(null)
  const [entitlement, setEntitlement] = useState<WebEntitlementView | null>(null)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [learningTick, setLearningTick] = useState(0)
  const [extensionBridgeReady, setExtensionBridgeReady] = useState<boolean | null>(null)
  const [learningSyncStatus, setLearningSyncStatus] = useState<LearningSyncStatus>('idle')
  const [canonicalEvents, setCanonicalEvents] = useState<ReturnType<typeof readWebLearningStore>['events']>([])

  const refreshSession = useCallback(async () => {
    setSessionChecking(true)
    const [accountResult, online] = await Promise.all([loadWebAccount(), probePublicApi()])
    if (accountResult.ok) {
      setAccount(accountResult.account)
      setEntitlement(accountResult.entitlement)
      accountSnapshotRef.current = accountResult.account.id
      setConsentAccepted(readWebAiConsent(accountResult.account.id))
      void bootstrapWebLearningSync(accountResult.account.id).then(async () => {
        const events = await fetchCanonicalLearningEvents(accountResult.account.id)
        setCanonicalEvents(events)
        setLearningTick((value) => value + 1)
      })
    } else {
      setAccount(null)
      setEntitlement(null)
      accountSnapshotRef.current = null
      setConsentAccepted(false)
    }
    setApiOnline(online)
    setSessionChecking(false)
  }, [])

  useEffect(() => {
    void refreshSession()
  }, [refreshSession])

  useEffect(() => {
    if (apiOnline !== false) return
    const timer = setInterval(() => {
      void probePublicApi().then((online) => {
        if (online) {
          setApiOnline(true)
          void refreshSession()
        }
      })
    }, 8_000)
    return () => clearInterval(timer)
  }, [apiOnline, refreshSession])

  const gate = useMemo(
    () =>
      resolveWritingLabGate({
        sessionChecking,
        apiOnline,
        account,
        entitlement,
        consentAccepted,
      }),
    [sessionChecking, apiOnline, account, entitlement, consentAccepted],
  )

  const learningEvents = useMemo(() => {
    if (!account) return []
    void learningTick
    return canonicalEvents.length > 0 ? canonicalEvents : readWebLearningStore(account.id).events
  }, [account, canonicalEvents, learningTick])

  const summary = useMemo(() => {
    if (!response) return null
    return summarizeWebLearning(learningEvents, response.changes.length)
  }, [learningEvents, response])

  const syncHeight = useCallback(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 320)}px`
  }, [])

  useEffect(() => {
    syncHeight()
  }, [input, syncHeight])

  const canAnalyze =
    gate === 'ready' &&
    phase !== 'working' &&
    validateWritingLabInput(
      input,
      WEB_CORRECTION_MIN_CHARS,
      WEB_CORRECTION_MIN_WORDS,
      WEB_CORRECTION_MAX_CHARS,
    ).ok

  const cancelInflight = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const analyze = useCallback(async () => {
    const validation = validateWritingLabInput(
      input,
      WEB_CORRECTION_MIN_CHARS,
      WEB_CORRECTION_MIN_WORDS,
      WEB_CORRECTION_MAX_CHARS,
    )
    if (!validation.ok) {
      if (validation.reason === 'empty') setError(copy.errors.empty)
      else if (validation.reason === 'too_short') setError(copy.errors.tooShort)
      else setError(copy.errors.tooLong)
      setPhase('error')
      return
    }

    if (gate !== 'ready') return

    cancelInflight()
    const controller = new AbortController()
    abortRef.current = controller
    const requestSeq = requestSeqRef.current + 1
    requestSeqRef.current = requestSeq
    const accountIdAtStart = accountSnapshotRef.current
    const batchId = createBatchId()
    const text = input.trim()

    setPhase('working')
    setError(null)
    setResponse(null)
    setExpanded(null)

    const layout = repairKeyboardLayoutLocally(text)
    const result = await requestWebCorrection(layout.text, controller.signal)

    if (requestSeq !== requestSeqRef.current) return
    if (accountIdAtStart !== accountSnapshotRef.current) return

    if (!result.ok) {
      if (result.code === 'aborted') {
        setPhase('idle')
        return
      }
      if (layout.changes.length > 0) {
        const localOnly = mergeLayoutAndCorrection(text, layout, null)
        setResponse(localOnly)
        setPhase('done')
        if (accountIdAtStart) {
          void syncWritingLabCorrection(accountIdAtStart, batchId, text, localOnly).then(async (status) => {
            if (accountIdAtStart !== accountSnapshotRef.current) return
            setLearningSyncStatus(status)
            const events = await fetchCanonicalLearningEvents(accountIdAtStart)
            if (accountIdAtStart !== accountSnapshotRef.current) return
            setCanonicalEvents(events)
            setLearningTick((value) => value + 1)
          })
        }
        return
      }
      if (result.code === 'auth') setError(copy.errors.auth)
      else if (result.code === 'credits') setError(copy.errors.credits)
      else if (result.code === 'rate_limited') setError(copy.errors.rateLimited)
      else if (result.code === 'unavailable') setError(copy.errors.unavailable)
      else if (result.code === 'invalid') setError(copy.errors.invalid)
      else setError(copy.errors.network)
      setPhase('error')
      return
    }

    const merged = mergeLayoutAndCorrection(text, layout, result.data)
    setResponse(merged)
    setPhase('done')

    if (accountIdAtStart) {
      void syncWritingLabCorrection(accountIdAtStart, batchId, text, merged).then(async (status) => {
        if (accountIdAtStart !== accountSnapshotRef.current) return
        setLearningSyncStatus(status)
        const events = await fetchCanonicalLearningEvents(accountIdAtStart)
        if (accountIdAtStart !== accountSnapshotRef.current) return
        setCanonicalEvents(events)
        setLearningTick((value) => value + 1)
      })
    }
  }, [accountSnapshotRef, cancelInflight, copy.errors, gate, input])

  useEffect(() => () => cancelInflight(), [cancelInflight])

  function localizedExplanation(explanation: RuleExplanation): RuleExplanation {
    return resolveLocalizedPresentation(explanation, locale)
  }

  function renderGateMessage(): string | null {
    if (gate === 'checking') return copy.gates.checking
    if (gate === 'requires_auth') return copy.gates.signIn
    if (gate === 'requires_consent') return null
    if (gate === 'credits_exhausted') return copy.gates.credits
    if (gate === 'unavailable') return copy.gates.unavailable
    return null
  }

  function recurringForIndex(index: number): WebRecurringPattern | null {
    if (!response) return null
    const change = response.changes[index]
    if (!change || change.type === 'layout') return null
    return findRecurringForChange(learningEvents, change)
  }

  useEffect(() => {
    void probeExtensionBridge().then(setExtensionBridgeReady)
  }, [])

  const openPracticeForPattern = useCallback(async (pattern: WebRecurringPattern) => {
    const targetId = practiceTargetIdForPattern(pattern)
    const connected = extensionBridgeReady ?? (await probeExtensionBridge())
    if (connected) {
      publishOpenDashboard('practice', targetId)
      return
    }
    setExtensionBridgeReady(false)
  }, [extensionBridgeReady])

  const writingChanges = response?.changes ?? []

  return (
    <div className="writing-lab" id="writing-lab">
      <div className="writing-lab-card">
        <div className="writing-lab-editor">
          <label className="visually-hidden" htmlFor="writing-lab-input">
            {copy.inputAria}
          </label>
          <textarea
            id="writing-lab-input"
            ref={textareaRef}
            className="writing-lab-textarea"
            placeholder={copy.placeholder}
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              if (phase === 'done' || phase === 'error') {
                setPhase('idle')
                setResponse(null)
                setError(null)
              }
            }}
            aria-describedby="writing-lab-disclaimer"
            disabled={phase === 'working'}
          />
          <div className={`writing-lab-actions${phase === 'working' ? ' is-ai-working' : ''}`}>
            <p id="writing-lab-disclaimer" className="writing-lab-disclaimer">
              {account ? copy.disclaimerSignedIn : copy.disclaimerSignedOut}
            </p>
            <Button
              type="button"
              variant="primary"
              className="btn-hero"
              disabled={!canAnalyze && gate !== 'requires_auth'}
              aria-busy={phase === 'working'}
              onClick={() => {
                if (gate === 'requires_auth') {
                  window.location.assign('/account?next=lab')
                  return
                }
                void analyze()
              }}
            >
              {phase === 'working' ? copy.analyzing : copy.analyze}
            </Button>
          </div>
        </div>

        {gate === 'requires_consent' ? (
          <div className="writing-lab-consent">
            <p>{copy.consentBody}</p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!account) return
                acceptWebAiConsent(account.id)
                setConsentAccepted(true)
              }}
            >
              {copy.consentAccept}
            </Button>
          </div>
        ) : null}

        {renderGateMessage() ? (
          <p className="writing-lab-gate" role="status">
            {renderGateMessage()}
            {gate === 'requires_auth' ? (
              <>
                {' '}
                <Button variant="secondary" to="/account?next=lab">
                  {copy.signInCta}
                </Button>
              </>
            ) : null}
            {gate === 'credits_exhausted' ? (
              <>
                {' '}
                <Button variant="secondary" to="/pricing">
                  {copy.upgradeCta}
                </Button>
              </>
            ) : null}
          </p>
        ) : null}

        {phase === 'error' && error ? <p className="writing-lab-error">{error}</p> : null}

        {phase === 'done' && response ? (
          <div className="writing-lab-results">
            {learningSyncStatus === 'synced' ? (
              <p className="writing-lab-disclaimer" role="status">
                {copy.learningSynced}
              </p>
            ) : learningSyncStatus === 'already_recorded' ? (
              <p className="writing-lab-disclaimer" role="status">
                {copy.learningAlreadyRecorded}
              </p>
            ) : learningSyncStatus === 'pending' ? (
              <p className="writing-lab-disclaimer" role="status">
                {copy.learningPending}
              </p>
            ) : null}
            <section aria-labelledby="writing-lab-your-writing">
              <h3 id="writing-lab-your-writing" className="writing-lab-section-title">
                {copy.yourWriting}
              </h3>
              <p className="writing-lab-original">{response.originalText}</p>
            </section>

            {response.correctedText && response.correctedText !== response.originalText ? (
              <section aria-labelledby="writing-lab-corrected">
                <h3 id="writing-lab-corrected" className="writing-lab-section-title">
                  {copy.correctedWriting}
                </h3>
                <p className="writing-lab-original">{response.correctedText}</p>
              </section>
            ) : null}

            <section aria-labelledby="writing-lab-corrections">
              <h3 id="writing-lab-corrections" className="writing-lab-section-title">
                {copy.corrections}
              </h3>
              {writingChanges.length === 0 ? (
                <p className="writing-lab-empty">{copy.noCorrections}</p>
              ) : (
                <ul className="writing-lab-corrections">
                  {response.changes.map((change, index) => {
                    const explanation = response.explanations?.[index]
                    const recurring = recurringForIndex(index)
                    return (
                      <li key={`${change.type}-${change.start}-${change.original}`} className={`writing-lab-correction is-${change.type}`}>
                        <div className="writing-lab-correction-head">
                          <span className="writing-lab-category">
                            {categoryLabel(change.type, copy.categories)}
                          </span>
                        </div>
                        <p className="writing-lab-pair">
                          <span className="from">&quot;{change.original}&quot;</span>
                          <span className="arrow">→</span>
                          <span>&quot;{change.corrected}&quot;</span>
                        </p>
                        {explanation ? (
                          <button
                            type="button"
                            className="writing-lab-inline-btn"
                            aria-expanded={expanded === index}
                            onClick={() => setExpanded(expanded === index ? null : index)}
                          >
                            {expanded === index ? copy.hideExplanation : copy.understandThis}
                          </button>
                        ) : null}
                        {expanded === index && explanation ? (
                          <div className="writing-lab-explanation">
                            <p>{localizedExplanation(explanation).summary}</p>
                            {localizedExplanation(explanation).why ? (
                              <p>{localizedExplanation(explanation).why}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {recurring && recurring.count >= 2 ? (
                          <>
                            <p className="writing-lab-meta">
                              {copy.recurringSeen.replace('{count}', String(recurring.count))}
                            </p>
                            <div className="writing-lab-bridge">
                              <Button
                                type="button"
                                variant="secondary"
                                className="btn-sm"
                                onClick={() => void openPracticeForPattern(recurring)}
                              >
                                {extensionBridgeReady === false ? copy.practiceInExtension : copy.practiceThis}
                              </Button>
                              {extensionBridgeReady === false ? (
                                <p className="writing-lab-meta">{copy.installForPractice}</p>
                              ) : null}
                            </div>
                          </>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {summary ? (
              <section aria-labelledby="writing-lab-noticed">
                <h3 id="writing-lab-noticed" className="writing-lab-section-title">
                  {copy.whatFlowlaryNoticed}
                </h3>
                <div className="writing-lab-notice">
                  {summary.correctionCount > 0 ? (
                    <p>
                      {copy.correctionsFound.replace('{count}', String(summary.correctionCount))}
                    </p>
                  ) : null}
                  {summary.topRecurring ? (
                    <>
                      <p>{copy.recurringBefore}</p>
                      <p>
                        {copy.recurringSeen.replace('{count}', String(summary.topRecurring.count))}
                      </p>
                      <div className="writing-lab-bridge">
                        <GetFlowlaryButton className="btn-sm" />
                      </div>
                    </>
                  ) : summary.personalizationReady && summary.focusArea ? (
                    <p>
                      {copy.focusHint.replace('{area}', copy.categories[summary.focusArea])}
                    </p>
                  ) : (
                    <p>{copy.keepWriting}</p>
                  )}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="writing-lab-bridge">
              <h3 id="writing-lab-bridge" className="writing-lab-section-title">
                {copy.continueLearning}
              </h3>
              <div className="writing-lab-bridge">
                <GetFlowlaryButton />
                <Button variant="secondary" to="/account">
                  {copy.viewProgress}
                </Button>
              </div>
              <p className="writing-lab-disclaimer">{copy.extensionBridge}</p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}
