import { useCallback, useState } from 'react'
import type { LearningFocus, LearningLevel, LearningProfile, OnboardingStep } from '@flowlary/shared'
import { isOnboardingStep, LEARNING_FOCUS_AREAS, LEARNING_LEVELS } from '@flowlary/shared'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import {
  completeOnboarding,
  patchCorrection,
  patchLearningProfile,
  patchWritingPolicy,
  setOnboardingStep,
} from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import { learningSkipDefaults } from '../../storage/learning/index.ts'
import { policyPatchFromFirstWin } from '../../core/policy/writingPolicy.ts'

const STEPS: OnboardingStep[] = ['welcome', 'tools']

function resolveLightStep(step: OnboardingStep): OnboardingStep {
  if (step === 'learning' || step === 'ready') return 'tools'
  return step === 'tools' ? 'tools' : 'welcome'
}

const STEP_LABEL_KEYS: Record<OnboardingStep, string> = {
  welcome: 'onboarding.stepWelcome',
  learning: 'onboarding.stepLearning',
  tools: 'onboarding.stepTools',
  ready: 'onboarding.stepReady',
}

type OnboardingFlowProps = {
  status: ExtensionStatus
  profile: LearningProfile
  busy: boolean
  onStatusChange: (status: ExtensionStatus) => void
  onProfileChange: (profile: LearningProfile) => void
  onComplete: (profile: LearningProfile) => void
}

function stepIndex(step: OnboardingStep): number {
  return STEPS.indexOf(step)
}

export function OnboardingFlow({
  status,
  profile,
  busy,
  onStatusChange,
  onProfileChange,
  onComplete,
}: OnboardingFlowProps) {
  const initialStep = resolveLightStep(
    isOnboardingStep(profile.onboardingStep) ? profile.onboardingStep : 'welcome',
  )
  const [step, setStep] = useState<OnboardingStep>(initialStep)
  const [consent, setConsent] = useState(status.correction.consentAccepted)
  const [level, setLevel] = useState<LearningLevel | ''>(profile.level ?? '')
  const [focusAreas, setFocusAreas] = useState<LearningFocus[]>(profile.focusAreas)
  const [nativeLanguage, setNativeLanguage] = useState(profile.nativeLanguage ?? '')
  const [fixTyping, setFixTyping] = useState(status.layout.autoEnabled)
  const [englishAssist, setEnglishAssist] = useState<'auto' | 'shortcut'>('auto')
  const [translateMode, setTranslateMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stepNumber = stepIndex(step) + 1
  const progressPct = Math.round((stepNumber / STEPS.length) * 100)

  const toggleFocus = useCallback((focus: LearningFocus) => {
    setFocusAreas((current) =>
      current.includes(focus) ? current.filter((item) => item !== focus) : [...current, focus],
    )
  }, [])

  async function changeStep(next: OnboardingStep) {
    setStep(next)
    const response = await setOnboardingStep(next)
    onProfileChange(response.profile)
  }

  async function persistWelcome() {
    if (consent !== status.correction.consentAccepted) {
      const next = await patchCorrection({ consentAccepted: consent })
      onStatusChange(next)
    }
  }

  async function persistLearning(useDefaults: boolean) {
    const payload = useDefaults
      ? learningSkipDefaults()
      : {
          learningLanguage: 'en',
          level: level || null,
          focusAreas: focusAreas.length > 0 ? focusAreas : learningSkipDefaults().focusAreas,
          nativeLanguage: nativeLanguage || null,
        }
    const response = await patchLearningProfile(payload)
    onProfileChange(response.profile)
  }

  async function persistTools(useDefaults: boolean) {
    if (useDefaults) {
      return
    }
    const mapped = policyPatchFromFirstWin({
      fixWrongTyping: fixTyping,
      improveEnglishAuto: englishAssist === 'auto',
      arabicToEnglishMode: translateMode,
    })
    const next = await patchWritingPolicy(mapped.policy)
    onStatusChange(next)
    if (mapped.correctionMode === 'box') {
      onStatusChange(await patchCorrection({ mode: 'box' }))
    }
  }

  async function goNext() {
    setError(null)
    try {
      if (step === 'welcome') {
        await persistWelcome()
        await changeStep('tools')
        return
      }
      if (step === 'tools') {
        await persistTools(false)
        const response = await completeOnboarding()
        onProfileChange(response.profile)
        onComplete(response.profile)
      }
    } catch {
      setError(t('errors.saveSettings'))
    }
  }

  async function goBack() {
    setError(null)
    const index = stepIndex(step)
    if (index <= 0) return
    await changeStep(STEPS[index - 1]!)
  }

  async function skipStep() {
    setError(null)
    try {
      if (step === 'tools') {
        await persistTools(true)
        const response = await completeOnboarding()
        onProfileChange(response.profile)
        onComplete(response.profile)
      }
    } catch {
      setError(t('errors.saveSettings'))
    }
  }

  const focusSummary = (focusAreas.length > 0 ? focusAreas : learningSkipDefaults().focusAreas)
    .map((area) => t(`learning.focus.${area}`))
    .join(' + ')

  return (
    <div className="fl-onboarding" role="dialog" aria-modal="true" aria-labelledby="fl-onboarding-title">
      <div className="fl-onboarding-panel">
        <header className="fl-onboarding-header">
          <div className="fl-onboarding-progress" aria-hidden="true">
            <div className="fl-onboarding-progress-track">
              <div className="fl-onboarding-progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <ol className="fl-onboarding-dots">
              {STEPS.map((item, index) => {
                const active = index === stepIndex(step)
                const done = index < stepIndex(step)
                return (
                  <li
                    key={item}
                    className={`fl-onboarding-dot${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                  />
                )
              })}
            </ol>
          </div>
          <p className="fl-onboarding-step-label">
            {t('onboarding.stepIndicator', { current: String(stepNumber), total: String(STEPS.length) })}
            <span className="fl-onboarding-step-name-current"> · {t(STEP_LABEL_KEYS[step])}</span>
          </p>
        </header>

        <div className="fl-onboarding-body">
          {step === 'welcome' ? (
            <section className="fl-onboarding-step">
              <h2 id="fl-onboarding-title" className="fl-onboarding-title">
                {t('onboarding.welcomeTitle')}
              </h2>
              <p className="fl-onboarding-lead">{t('onboarding.welcomeLead')}</p>
              <ul className="fl-onboarding-list">
                <li>{t('onboarding.privacyAi')}</li>
                <li>{t('onboarding.privacyLocal')}</li>
                <li>{t('onboarding.privacyProtected')}</li>
              </ul>
              <label className="fl-onboarding-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                />
                <span>{t('onboarding.consentLabel')}</span>
              </label>
              <p className="fl-onboarding-note">{t('onboarding.consentNote')}</p>
            </section>
          ) : null}

          {step === 'learning' ? (
            <section className="fl-onboarding-step">
              <h2 id="fl-onboarding-title" className="fl-onboarding-title">
                {t('onboarding.learningTitle')}
              </h2>
              <p className="fl-onboarding-lead">{t('onboarding.learningLead')}</p>

              <div className="fl-onboarding-field">
                <span className="fl-onboarding-label">{t('learning.learningLanguage')}</span>
                <div className="fl-onboarding-locked" aria-live="polite">
                  <strong>{t('learning.englishOnly')}</strong>
                  <span>{t('onboarding.learningLanguageLocked')}</span>
                </div>
              </div>

              <div className="fl-onboarding-field">
                <label className="fl-onboarding-label" htmlFor="onboarding-level">
                  {t('learning.currentLevel')}
                </label>
                <select
                  id="onboarding-level"
                  value={level}
                  onChange={(event) => setLevel(event.target.value as LearningLevel | '')}
                >
                  <option value="">{t('learning.levelNotSure')}</option>
                  {LEARNING_LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {t(`learning.level.${item}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fl-onboarding-field">
                <span className="fl-onboarding-label" id="onboarding-focus-label">
                  {t('learning.focusAreas')}
                </span>
                <p className="fl-onboarding-hint">{t('onboarding.focusHint')}</p>
                <div
                  className="fl-onboarding-chips"
                  role="group"
                  aria-labelledby="onboarding-focus-label"
                >
                  {LEARNING_FOCUS_AREAS.map((focus) => (
                    <label key={focus} className="fl-onboarding-chip">
                      <input
                        type="checkbox"
                        checked={focusAreas.includes(focus)}
                        onChange={() => toggleFocus(focus)}
                      />
                      <span className="fl-onboarding-chip-mark" aria-hidden="true" />
                      <span>{t(`learning.focus.${focus}`)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="fl-onboarding-field">
                <label className="fl-onboarding-label" htmlFor="onboarding-native">
                  {t('learning.nativeLanguageOptional')}
                </label>
                <select
                  id="onboarding-native"
                  value={nativeLanguage}
                  onChange={(event) => setNativeLanguage(event.target.value)}
                >
                  <option value="">{t('learning.nativeNone')}</option>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          ) : null}

          {step === 'tools' ? (
            <section className="fl-onboarding-step">
              <h2 id="fl-onboarding-title" className="fl-onboarding-title">
                {t('onboarding.toolsTitle')}
              </h2>
              <p className="fl-onboarding-lead">{t('onboarding.toolsLead')}</p>

              <label className="fl-onboarding-consent fl-onboarding-toggle-row">
                <input
                  type="checkbox"
                  checked={fixTyping}
                  onChange={(event) => setFixTyping(event.target.checked)}
                />
                <span>{t('onboarding.qFixTyping')}</span>
              </label>

              <div className="fl-onboarding-field">
                <span className="fl-onboarding-label">{t('onboarding.qEnglish')}</span>
                <div className="fl-onboarding-segmented" role="radiogroup" aria-label={t('onboarding.qEnglish')}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={englishAssist === 'auto'}
                    className={englishAssist === 'auto' ? 'is-active' : ''}
                    onClick={() => setEnglishAssist('auto')}
                  >
                    {t('onboarding.qEnglishAuto')}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={englishAssist === 'shortcut'}
                    className={englishAssist === 'shortcut' ? 'is-active' : ''}
                    onClick={() => setEnglishAssist('shortcut')}
                  >
                    {t('onboarding.qEnglishShortcut')}
                  </button>
                </div>
              </div>

              <label className="fl-onboarding-consent fl-onboarding-toggle-row">
                <input
                  type="checkbox"
                  checked={translateMode}
                  onChange={(event) => setTranslateMode(event.target.checked)}
                />
                <span>
                  <strong>{t('onboarding.qTranslate')}</strong>
                  <em>{t('onboarding.qTranslateNote')}</em>
                </span>
              </label>
            </section>
          ) : null}

          {step === 'ready' ? (
            <section className="fl-onboarding-step">
              <h2 id="fl-onboarding-title" className="fl-onboarding-title">
                {t('onboarding.readyTitle')}
              </h2>
              <p className="fl-onboarding-lead">{t('onboarding.readyLead')}</p>
              <ul className="fl-onboarding-summary">
                <li>
                  <span>{t('learning.learningLanguage')}</span>
                  <strong>{t('learning.englishOnly')}</strong>
                </li>
                <li>
                  <span>{t('learning.focusAreas')}</span>
                  <strong>{focusSummary}</strong>
                </li>
                <li>
                  <span>{t('features.layout')}</span>
                  <strong>{fixTyping ? t('assistant.style.auto') : t('assistant.style.shortcuts_only')}</strong>
                </li>
                <li>
                  <span>{t('features.correction')}</span>
                  <strong>
                    {englishAssist === 'auto' ? t('onboarding.qEnglishAuto') : t('onboarding.qEnglishShortcut')}
                  </strong>
                </li>
                <li>
                  <span>{t('features.liveTranslation')}</span>
                  <strong>{translateMode ? t('assistant.style.auto') : t('assistant.style.shortcuts_only')}</strong>
                </li>
              </ul>
              <p className="fl-onboarding-note">{t('onboarding.readyTourNote')}</p>
            </section>
          ) : null}

          {error ? (
            <p className="fl-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="fl-onboarding-actions">
          {step !== 'welcome' ? (
            <button
              type="button"
              className="fl-action-btn fl-action-btn-compact fl-onboarding-btn"
              disabled={busy}
              onClick={() => void goBack()}
            >
              {t('onboarding.back')}
            </button>
          ) : (
            <span className="fl-onboarding-actions-spacer" aria-hidden="true" />
          )}
          <div className="fl-onboarding-actions-main">
            {step !== 'welcome' ? (
              <button
                type="button"
                className="fl-action-btn fl-action-btn-compact fl-action-btn-muted fl-onboarding-btn"
                disabled={busy}
                onClick={() => void skipStep()}
              >
                {t('onboarding.skip')}
              </button>
            ) : null}
            <button
              type="button"
              className="fl-action-btn fl-action-btn-compact fl-action-btn-primary fl-onboarding-btn fl-onboarding-btn-primary"
              disabled={busy}
              onClick={() => void goNext()}
            >
              {step === 'ready'
                ? t('onboarding.startWriting')
                : step === 'welcome'
                  ? t('onboarding.getStarted')
                  : t('onboarding.continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
