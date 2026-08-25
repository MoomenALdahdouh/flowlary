import { useCallback, useEffect, useMemo, useState } from 'react'
import { BRAND } from '@flowlary/shared'
import type { ExtensionStatus } from '../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../features/translation/languages.ts'
import {
  dispatchCommand,
  fetchStatus,
  patchCorrection,
  patchLayout,
  patchTranslation,
  PopupApiError,
  removeGroqKey,
  saveGroqKey,
  setGlobalActive,
} from './api.ts'
import { FeatureCard, ToggleSwitch } from './components.tsx'
import {
  computeFeatureStatus,
  formatLanguagePair,
  groqKeyLabel,
  readinessLabel,
} from './status.ts'
import { getShortcutLabels } from './shortcuts.ts'

type View = 'home' | 'settings'

function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.name ?? code.toUpperCase()
}

export function App() {
  const [view, setView] = useState<View>('home')
  const [status, setStatus] = useState<ExtensionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [groqDraft, setGroqDraft] = useState('')
  const [showKeyForm, setShowKeyForm] = useState(false)

  const shortcuts = useMemo(() => getShortcutLabels(), [])
  const featureStatus = useMemo(() => computeFeatureStatus(status), [status])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await fetchStatus()
      setStatus(next)
    } catch (err) {
      setError(err instanceof PopupApiError ? err.message : 'Could not load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function mutate(
    key: string,
    fn: () => Promise<ExtensionStatus>,
    rollback?: () => void,
  ): Promise<void> {
    setBusy(key)
    setError(null)
    try {
      const next = await fn()
      setStatus(next)
    } catch (err) {
      rollback?.()
      setError(err instanceof PopupApiError ? err.message : 'Could not save your settings. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const active = status?.active ?? false
  const correctionOn = status?.correction.enabled ?? false
  const translationOn = status?.translation.shortcutEnabled ?? false
  const liveOn = status?.translation.liveEnabled ?? false
  const layoutOn = status?.layout.autoEnabled ?? false
  const hasGroqKey = status?.correction.hasGroqKey ?? false

  const languagePair =
    status &&
    formatLanguagePair(
      status.translation.sourceLanguage,
      status.translation.targetLanguage,
      languageName(status.translation.sourceLanguage),
      languageName(status.translation.targetLanguage),
    )

  return (
    <div className="fl-popup">
      <header className="fl-header">
        <div>
          <h1 className="fl-title">{BRAND.name}</h1>
          <p className="fl-subtitle">Write better. Understand. Fix layout mistakes.</p>
        </div>
        <button
          type="button"
          className="fl-icon-btn"
          aria-label={view === 'home' ? 'Open settings' : 'Back to home'}
          onClick={() => setView(view === 'home' ? 'settings' : 'home')}
        >
          {view === 'home' ? '⚙' : '←'}
        </button>
      </header>

      <div
        className={`fl-global-status tone-${featureStatus.summaryTone}`}
        role="status"
        aria-live="polite"
      >
        <span className={`fl-status-dot${active ? ' is-active' : ''}`} aria-hidden />
        <span>{loading ? 'Loading…' : featureStatus.summary}</span>
      </div>

      {error ? (
        <div className="fl-error" role="alert">
          {error}
        </div>
      ) : null}

      {view === 'home' ? (
        <>
          <section className="fl-section" aria-labelledby="features-heading">
            <h2 id="features-heading" className="fl-section-label">
              Writing intelligence
            </h2>

            <FeatureCard
              primary
              title="Writing Correction"
              description="Improve English while you write"
              meta="English writing"
              status={readinessLabel(featureStatus.correction)}
              statusTone={featureStatus.correction === 'setup' ? 'warn' : 'ok'}
              toggle={
                <ToggleSwitch
                  id="toggle-correction"
                  label="Writing Correction"
                  checked={correctionOn}
                  disabled={!active || loading}
                  busy={busy === 'correction'}
                  onChange={(next) => {
                    const prev = correctionOn
                    setStatus((s) =>
                      s ? { ...s, correction: { ...s.correction, enabled: next } } : s,
                    )
                    void mutate(
                      'correction',
                      () => patchCorrection({ enabled: next }),
                      () =>
                        setStatus((s) =>
                          s ? { ...s, correction: { ...s.correction, enabled: prev } } : s,
                        ),
                    )
                  }}
                />
              }
            >
              <div className="fl-inline-meta">
                <span>Groq API</span>
                <strong>{groqKeyLabel(hasGroqKey)}</strong>
              </div>
              {!hasGroqKey ? (
                <button
                  type="button"
                  className="fl-link-btn"
                  onClick={() => {
                    setView('settings')
                    setShowKeyForm(true)
                  }}
                >
                  Add API key
                </button>
              ) : null}
            </FeatureCard>

            <FeatureCard
              title="Translation"
              description="Translate selected or current text"
              meta={languagePair ?? '—'}
              status={readinessLabel(featureStatus.translation)}
              toggle={
                <ToggleSwitch
                  id="toggle-translation"
                  label="Translation"
                  checked={translationOn}
                  disabled={!active || loading}
                  busy={busy === 'translation'}
                  onChange={(next) => {
                    const prev = translationOn
                    const prevLive = liveOn
                    setStatus((s) =>
                      s
                        ? {
                            ...s,
                            translation: {
                              ...s.translation,
                              shortcutEnabled: next,
                              liveEnabled: next ? s.translation.liveEnabled : false,
                            },
                          }
                        : s,
                    )
                    void mutate(
                      'translation',
                      () =>
                        patchTranslation({
                          shortcutEnabled: next,
                          liveEnabled: next ? liveOn : false,
                        }),
                      () =>
                        setStatus((s) =>
                          s
                            ? {
                                ...s,
                                translation: {
                                  ...s.translation,
                                  shortcutEnabled: prev,
                                  liveEnabled: prevLive,
                                },
                              }
                            : s,
                        ),
                    )
                  }}
                />
              }
            >
              <div className="fl-subrow">
                <div>
                  <p className="fl-subrow-title">Live Translation</p>
                  <p className="fl-subrow-desc">Translate while you type</p>
                </div>
                <ToggleSwitch
                  id="toggle-live"
                  label="Live Translation"
                  checked={liveOn}
                  disabled={!active || !translationOn || loading}
                  busy={busy === 'live'}
                  onChange={(next) => {
                    const prev = liveOn
                    setStatus((s) =>
                      s ? { ...s, translation: { ...s.translation, liveEnabled: next } } : s,
                    )
                    void mutate(
                      'live',
                      () => patchTranslation({ liveEnabled: next }),
                      () =>
                        setStatus((s) =>
                          s ? { ...s, translation: { ...s.translation, liveEnabled: prev } } : s,
                        ),
                    )
                  }}
                />
              </div>
            </FeatureCard>

            <FeatureCard
              title="Keyboard Layout"
              description="Automatically fix text typed with the wrong keyboard layout"
              status={readinessLabel(featureStatus.layout)}
              toggle={
                <ToggleSwitch
                  id="toggle-layout"
                  label="Keyboard Layout"
                  checked={layoutOn}
                  disabled={!active || loading}
                  busy={busy === 'layout'}
                  onChange={(next) => {
                    const prev = layoutOn
                    setStatus((s) =>
                      s ? { ...s, layout: { ...s.layout, autoEnabled: next } } : s,
                    )
                    void mutate(
                      'layout',
                      () => patchLayout({ autoEnabled: next }),
                      () =>
                        setStatus((s) =>
                          s ? { ...s, layout: { ...s.layout, autoEnabled: prev } } : s,
                        ),
                    )
                  }}
                />
              }
            />
          </section>

          <section className="fl-section" aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="fl-section-label">
              Quick actions
            </h2>
            <div className="fl-action-row">
              <button
                type="button"
                className="fl-action-btn"
                disabled={!active || !translationOn || busy === 'cmd-translate'}
                onClick={() => void mutate('cmd-translate', () => dispatchCommand('TRANSLATE').then(() => fetchStatus()))}
              >
                Translate
              </button>
              <button
                type="button"
                className="fl-action-btn"
                disabled={!active || !layoutOn || busy === 'cmd-layout'}
                onClick={() => void mutate('cmd-layout', () => dispatchCommand('FIX_LAYOUT').then(() => fetchStatus()))}
              >
                Fix Layout
              </button>
            </div>
          </section>

          <section className="fl-section" aria-labelledby="shortcuts-heading">
            <h2 id="shortcuts-heading" className="fl-section-label">
              Shortcuts
            </h2>
            <ul className="fl-shortcut-list">
              <li>
                <span>Translate</span>
                <kbd>{shortcuts.translate}</kbd>
              </li>
              <li>
                <span>Fix Layout</span>
                <kbd>{shortcuts.fixLayout}</kbd>
              </li>
              <li>
                <span>Speed Box</span>
                <kbd>{shortcuts.speedBox}</kbd>
              </li>
            </ul>
          </section>

          <section className="fl-section" aria-labelledby="global-heading">
            <h2 id="global-heading" className="fl-section-label">
              Extension
            </h2>
            <div className="fl-subrow">
              <div>
                <p className="fl-subrow-title">Flowlary</p>
                <p className="fl-subrow-desc">{active ? 'Active on this browser' : 'Paused'}</p>
              </div>
              <ToggleSwitch
                id="toggle-global"
                label="Flowlary active"
                checked={active}
                disabled={loading}
                busy={busy === 'global'}
                onChange={(next) => {
                  const prev = active
                  setStatus((s) => (s ? { ...s, active: next } : s))
                  void mutate(
                    'global',
                    () => setGlobalActive(next),
                    () => setStatus((s) => (s ? { ...s, active: prev } : s)),
                  )
                }}
              />
            </div>
          </section>
        </>
      ) : (
        <SettingsPanel
          status={status}
          busy={busy}
          groqDraft={groqDraft}
          showKeyForm={showKeyForm}
          onGroqDraft={setGroqDraft}
          onShowKeyForm={setShowKeyForm}
          onMutate={mutate}
          onStatus={setStatus}
        />
      )}

      <footer className="fl-footer">
        <span>v{status?.version ?? BRAND.version}</span>
        {view === 'home' ? (
          <button type="button" className="fl-link-btn" onClick={() => setView('settings')}>
            Settings & privacy
          </button>
        ) : null}
      </footer>
    </div>
  )
}

type SettingsPanelProps = {
  status: ExtensionStatus | null
  busy: string | null
  groqDraft: string
  showKeyForm: boolean
  onGroqDraft: (value: string) => void
  onShowKeyForm: (value: boolean) => void
  onMutate: (key: string, fn: () => Promise<ExtensionStatus>, rollback?: () => void) => Promise<void>
  onStatus: (status: ExtensionStatus) => void
}

function SettingsPanel({
  status,
  busy,
  groqDraft,
  showKeyForm,
  onGroqDraft,
  onShowKeyForm,
  onMutate,
  onStatus,
}: SettingsPanelProps) {
  const hasGroqKey = status?.correction.hasGroqKey ?? false
  const mode = status?.correction.mode ?? 'direct'

  return (
    <div className="fl-settings">
      <section className="fl-section">
        <h2 className="fl-section-label">Writing</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>Correction mode</span>
            <select
              aria-label="Correction mode"
              value={mode}
              disabled={busy === 'mode'}
              onChange={(e) => {
                const next = e.target.value as 'box' | 'direct'
                const prev = mode
                onStatus({
                  ...(status as ExtensionStatus),
                  correction: { ...status!.correction, mode: next },
                })
                void onMutate(
                  'mode',
                  () => patchCorrection({ mode: next }),
                  () =>
                    onStatus({
                      ...(status as ExtensionStatus),
                      correction: { ...status!.correction, mode: prev },
                    }),
                )
              }}
            >
              <option value="direct">Direct edit</option>
              <option value="box">Suggestion card</option>
            </select>
          </p>
          <p className="fl-settings-row">
            <span>Highlights</span>
            <ToggleSwitch
              id="toggle-highlights"
              label="Correction highlights"
              checked={status?.correction.highlights ?? true}
              busy={busy === 'highlights'}
              onChange={(next) => {
                const prev = status?.correction.highlights ?? true
                onStatus({
                  ...(status as ExtensionStatus),
                  correction: { ...status!.correction, highlights: next },
                })
                void onMutate(
                  'highlights',
                  () => patchCorrection({ highlights: next }),
                  () =>
                    onStatus({
                      ...(status as ExtensionStatus),
                      correction: { ...status!.correction, highlights: prev },
                    }),
                )
              }}
            />
          </p>
        </div>

        <div className="fl-settings-block">
          <h3 className="fl-block-title">Groq API</h3>
          <p className="fl-card-desc">
            Your key stays in the browser. It is never shown after saving.
          </p>
          <p className="fl-inline-meta">
            <span>Status</span>
            <strong>{groqKeyLabel(hasGroqKey)}</strong>
          </p>
          {hasGroqKey && !showKeyForm ? (
            <div className="fl-action-row">
              <button type="button" className="fl-action-btn" onClick={() => onShowKeyForm(true)}>
                Change key
              </button>
              <button
                type="button"
                className="fl-action-btn fl-action-btn-muted"
                disabled={busy === 'remove-key'}
                onClick={() =>
                  void onMutate('remove-key', () => removeGroqKey(), undefined)
                }
              >
                Remove key
              </button>
            </div>
          ) : (
            <form
              className="fl-key-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (!groqDraft.trim()) return
                void onMutate('save-key', () => saveGroqKey(groqDraft), undefined).then(() => {
                  onGroqDraft('')
                  onShowKeyForm(false)
                })
              }}
            >
              <label className="fl-field-label" htmlFor="groq-key-input">
                API key
              </label>
              <input
                id="groq-key-input"
                type="password"
                autoComplete="off"
                placeholder="gsk_…"
                value={groqDraft}
                onChange={(e) => onGroqDraft(e.target.value)}
              />
              <button type="submit" className="fl-action-btn" disabled={!groqDraft.trim() || busy === 'save-key'}>
                Save key
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">Translation</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>Source</span>
            <select
              aria-label="Source language"
              value={status?.translation.sourceLanguage ?? 'ar'}
              disabled={busy === 'source-lang'}
              onChange={(e) => {
                const next = e.target.value
                const prev = status?.translation.sourceLanguage ?? 'ar'
                void onMutate(
                  'source-lang',
                  () => patchTranslation({ sourceLanguage: next }),
                  () =>
                    onStatus({
                      ...(status as ExtensionStatus),
                      translation: { ...status!.translation, sourceLanguage: prev },
                    }),
                )
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </p>
          <p className="fl-settings-row">
            <span>Target</span>
            <select
              aria-label="Target language"
              value={status?.translation.targetLanguage ?? 'en'}
              disabled={busy === 'target-lang'}
              onChange={(e) => {
                const next = e.target.value
                const prev = status?.translation.targetLanguage ?? 'en'
                void onMutate(
                  'target-lang',
                  () => patchTranslation({ targetLanguage: next }),
                  () =>
                    onStatus({
                      ...(status as ExtensionStatus),
                      translation: { ...status!.translation, targetLanguage: prev },
                    }),
                )
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">Keyboard layout</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>Manual shortcut</span>
            <ToggleSwitch
              id="toggle-layout-shortcut"
              label="Layout shortcut"
              checked={status?.layout.directShortcutEnabled ?? true}
              busy={busy === 'layout-shortcut'}
              onChange={(next) => {
                const prev = status?.layout.directShortcutEnabled ?? true
                onStatus({
                  ...(status as ExtensionStatus),
                  layout: { ...status!.layout, directShortcutEnabled: next },
                })
                void onMutate(
                  'layout-shortcut',
                  () => patchLayout({ directShortcutEnabled: next }),
                  () =>
                    onStatus({
                      ...(status as ExtensionStatus),
                      layout: { ...status!.layout, directShortcutEnabled: prev },
                    }),
                )
              }}
            />
          </p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">Privacy</h2>
        <div className="fl-privacy">
          <p>Flowlary runs primarily in your browser. Protected fields like passwords are blocked.</p>
          <p>Correction uses your Groq API key. Translation uses the configured translation service. Layout fixes are local-first.</p>
          <p>Your writing is not collected for analytics.</p>
        </div>
      </section>
    </div>
  )
}
