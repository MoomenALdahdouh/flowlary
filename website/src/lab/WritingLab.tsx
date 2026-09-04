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
import { InstallFlowlaryButton } from '../components/Ui.tsx'
import { Link } from 'react-router-dom'
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

export function WritingLab({
  embedded = false,
  onOpenProgress,
  onOpenPractice,
}: {
  embedded?: boolean
  onOpenProgress?: () => void
  onOpenPractice?: (targetId?: string) => void
}) {
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
    if (onOpenPractice) {
      onOpenPractice(targetId)
      return
    }
    const connected = extensionBridgeReady ?? (await probeExtensionBridge())
    if (connected) {
      publishOpenDashboard('practice', targetId)
      return
    }
    setExtensionBridgeReady(false)
  }, [extensionBridgeReady, onOpenPractice])

  const writingChanges = response?.changes ?? []
  const gateMessage = renderGateMessage()
  const charLabel = copy.charCount
    .replace('{count}', String(input.length))
    .replace('{max}', String(WEB_CORRECTION_MAX_CHARS))

  function typeCard(type: CorrectionChange['type']) {
    if (type === 'spelling') return 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
    if (type === 'grammar') return 'border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10'
    if (type === 'wording') return 'border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10'
    return 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10'
  }

  return (
    <div className="writing-lab grid gap-0 lg:grid-cols-5" id="writing-lab">
      <div className="writing-lab-card border-0 bg-transparent shadow-none lg:col-span-3 lg:border-e lg:border-slate-200 dark:lg:border-slate-700">
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{copy.editorTitle}</h3>
            <button
              type="button"
              className="text-xs font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400"
              onClick={() => {
                setInput(copy.sampleText)
                setPhase('idle')
                setResponse(null)
                setError(null)
              }}
            >
              {copy.insertSample}
            </button>
          </div>
          <label className="visually-hidden" htmlFor="writing-lab-input">
            {copy.inputAria}
          </label>
          <textarea
            id="writing-lab-input"
            ref={textareaRef}
            className="field-input min-h-[12rem] resize-y"
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
          <div className={`mt-4 flex flex-wrap items-center justify-between gap-3${phase === 'working' ? ' is-ai-working' : ''}`}>
            <p id="writing-lab-disclaimer" className="max-w-md text-xs text-slate-500 dark:text-slate-400">
              {account ? copy.disclaimerSignedIn : copy.disclaimerSignedOut}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-400">{charLabel}</span>
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={!canAnalyze && gate !== 'requires_auth'}
                aria-busy={phase === 'working'}
                onClick={() => {
                  if (gate === 'requires_auth') {
                    if (embedded) return
                    window.location.assign('/account?next=lab')
                    return
                  }
                  void analyze()
                }}
              >
                {phase === 'working' ? copy.analyzing : copy.analyze}
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="border-t border-slate-200 p-5 dark:border-slate-700 sm:p-6 lg:col-span-2 lg:border-t-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{copy.resultsTitle}</h3>

        {gate === 'requires_consent' ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <p className="text-sm text-slate-600 dark:text-slate-300">{copy.consentBody}</p>
            <button
              type="button"
              className="btn-secondary mt-4 text-sm"
              onClick={() => {
                if (!account) return
                acceptWebAiConsent(account.id)
                setConsentAccepted(true)
              }}
            >
              {copy.consentAccept}
            </button>
          </div>
        ) : null}

        {gateMessage ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300" role="status">
            <p>{gateMessage}</p>
            {gate === 'requires_auth' ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/account?next=lab" className="btn-primary text-sm">
                  {copy.signInCta}
                </Link>
                <Link to="/account?mode=register&next=lab" className="btn-secondary text-sm">
                  {copy.createAccountCta}
                </Link>
              </div>
            ) : null}
            {gate === 'credits_exhausted' ? (
              <Link to="/pricing" className="btn-secondary mt-4 inline-flex text-sm">
                {copy.upgradeCta}
              </Link>
            ) : null}
          </div>
        ) : null}

        {phase === 'error' && error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}

        {phase === 'idle' && gate === 'ready' && !response ? (
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{copy.resultsEmpty}</p>
        ) : null}

        {phase === 'done' && response ? (
          <div className="writing-lab-results mt-4 space-y-5 border-0 p-0">
            {learningSyncStatus === 'synced' ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
                {copy.learningSynced}
              </p>
            ) : learningSyncStatus === 'already_recorded' ? (
              <p className="text-xs text-slate-500" role="status">
                {copy.learningAlreadyRecorded}
              </p>
            ) : learningSyncStatus === 'pending' ? (
              <p className="text-xs text-slate-500" role="status">
                {copy.learningPending}
              </p>
            ) : null}

            {response.correctedText && response.correctedText !== response.originalText ? (
              <section aria-labelledby="writing-lab-corrected">
                <h4 id="writing-lab-corrected" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {copy.correctedWriting}
                </h4>
                <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                  {response.correctedText}
                </p>
              </section>
            ) : null}

            <section aria-labelledby="writing-lab-corrections">
              <h4 id="writing-lab-corrections" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {copy.corrections}
              </h4>
              {writingChanges.length === 0 ? (
                <p className="text-sm text-slate-500">{copy.noCorrections}</p>
              ) : (
                <ul className="space-y-3">
                  {response.changes.map((change, index) => {
                    const explanation = response.explanations?.[index]
                    const recurring = recurringForIndex(index)
                    return (
                      <li
                        key={`${change.type}-${change.start}-${change.original}`}
                        className={`rounded-xl border p-3 ${typeCard(change.type)}`}
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide">
                          {categoryLabel(change.type, copy.categories)}
                        </span>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                          <span className="text-slate-400 line-through">&quot;{change.original}&quot;</span>
                          <span className="mx-1 text-slate-400">→</span>
                          <span>&quot;{change.corrected}&quot;</span>
                        </p>
                        {explanation ? (
                          <button
                            type="button"
                            className="mt-2 text-xs font-semibold text-sky-600 dark:text-sky-400"
                            aria-expanded={expanded === index}
                            onClick={() => setExpanded(expanded === index ? null : index)}
                          >
                            {expanded === index ? copy.hideExplanation : copy.understandThis}
                          </button>
                        ) : null}
                        {expanded === index && explanation ? (
                          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            <p>{localizedExplanation(explanation).summary}</p>
                            {localizedExplanation(explanation).why ? (
                              <p className="mt-1">{localizedExplanation(explanation).why}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {recurring && recurring.count >= 2 ? (
                          <div className="mt-3">
                            <p className="text-xs text-slate-500">
                              {copy.recurringSeen.replace('{count}', String(recurring.count))}
                            </p>
                            <button
                              type="button"
                              className="btn-secondary mt-2 text-xs"
                              onClick={() => void openPracticeForPattern(recurring)}
                            >
                              {extensionBridgeReady === false ? copy.practiceInExtension : copy.practiceThis}
                            </button>
                            {extensionBridgeReady === false ? (
                              <p className="mt-1 text-xs text-slate-500">{copy.installForPractice}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {summary ? (
              <section aria-labelledby="writing-lab-noticed">
                <h4 id="writing-lab-noticed" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {copy.whatFlowlaryNoticed}
                </h4>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {summary.correctionCount > 0 ? (
                    <p>{copy.correctionsFound.replace('{count}', String(summary.correctionCount))}</p>
                  ) : null}
                  {summary.topRecurring ? (
                    <>
                      <p className="mt-2">{copy.recurringBefore}</p>
                      <p>{copy.recurringSeen.replace('{count}', String(summary.topRecurring.count))}</p>
                    </>
                  ) : summary.personalizationReady && summary.focusArea ? (
                    <p className="mt-2">{copy.focusHint.replace('{area}', copy.categories[summary.focusArea])}</p>
                  ) : (
                    <p className="mt-2">{copy.keepWriting}</p>
                  )}
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <InstallFlowlaryButton variant="secondary" className="text-sm" />
              {onOpenProgress ? (
                <button type="button" className="btn-secondary text-sm" onClick={onOpenProgress}>
                  {copy.viewProgress}
                </button>
              ) : (
                <Link to="/dashboard#progress" className="btn-secondary text-sm">
                  {copy.viewProgress}
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
