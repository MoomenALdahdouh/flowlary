import { useMemo, useRef, useState } from 'react'
import {
  LEARNING_FOCUS_AREAS,
  LEARNING_LEVELS,
  type LearningFocus,
  type LearningLevel,
  type LearningProfile,
} from '@flowlary/shared'
import { Check, ChevronDown, Download, GraduationCap, ShieldAlert, SlidersHorizontal, Upload } from 'lucide-react'
import { Button } from '../../components/Ui.tsx'
import type { DashboardCopy } from '../types.ts'
import { saveWebLearningProfile } from '../services/learningData.ts'
import {
  buildWebLearningExportWithEvents,
  importWebLearningExport,
  parseWebLearningExport,
} from '../services/dataPortability.ts'
import {
  clearWebLearningLocalData,
  readLearningProfile,
  resetWebLearningProfile,
} from '../storage/webLocalStore.ts'

type SettingsPanelProps = {
  accountId: string
  copy: DashboardCopy
  onRefresh: () => void
}

function sameProfile(a: LearningProfile, b: LearningProfile) {
  const focusA = [...a.focusAreas].sort().join(',')
  const focusB = [...b.focusAreas].sort().join(',')
  return a.level === b.level && focusA === focusB
}

function focusCopy(area: LearningFocus, copy: DashboardCopy) {
  if (area === 'spelling') {
    return { title: copy.practice.focusSpelling, hint: copy.settings.focusSpellingHint }
  }
  if (area === 'grammar') {
    return { title: copy.practice.focusGrammar, hint: copy.settings.focusGrammarHint }
  }
  return { title: copy.practice.focusWording, hint: copy.settings.focusWordingHint }
}

export function SettingsPanel({ accountId, copy, onRefresh }: SettingsPanelProps) {
  const [profile, setProfile] = useState(() => readLearningProfile(accountId))
  const [committed, setCommitted] = useState(profile)
  const [justSaved, setJustSaved] = useState(false)
  const [replaceProfileOnImport, setReplaceProfileOnImport] = useState(true)
  const [portabilityMessage, setPortabilityMessage] = useState<string | null>(null)
  const [portabilityOk, setPortabilityOk] = useState(true)
  const importRef = useRef<HTMLInputElement>(null)
  const dirty = useMemo(() => !sameProfile(profile, committed), [profile, committed])

  function updateProfile(next: LearningProfile) {
    setProfile(next)
    setJustSaved(false)
  }

  function toggleFocus(area: LearningFocus) {
    const next = profile.focusAreas.includes(area)
      ? profile.focusAreas.filter((item) => item !== area)
      : [...profile.focusAreas, area]
    updateProfile({ ...profile, focusAreas: next.length > 0 ? next : [area], updatedAt: Date.now() })
  }

  function setLevel(level: LearningLevel | undefined) {
    updateProfile({ ...profile, level, updatedAt: Date.now() })
  }

  function commit(next: LearningProfile) {
    setProfile(next)
    setCommitted(next)
    setJustSaved(true)
    void saveWebLearningProfile(accountId, next)
    onRefresh()
  }

  function onSave() {
    commit({ ...profile, updatedAt: Date.now() })
  }

  function onResetProfile() {
    if (!window.confirm(copy.settings.resetConfirm)) return
    const next = resetWebLearningProfile(accountId)
    commit(next)
  }

  function onClearLocal() {
    if (!window.confirm(copy.settings.clearLocalConfirm)) return
    clearWebLearningLocalData(accountId)
    onRefresh()
  }

  async function onExport() {
    const payload = await buildWebLearningExportWithEvents(accountId)
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `flowlary-learning-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setPortabilityOk(true)
    setPortabilityMessage(copy.settings.exportReady)
  }

  async function onImportFile(file: File) {
    try {
      const raw = await file.text()
      const payload = parseWebLearningExport(raw)
      await importWebLearningExport(accountId, payload, { replaceProfile: replaceProfileOnImport })
      setPortabilityOk(true)
      setPortabilityMessage(copy.settings.importReady)
      const next = readLearningProfile(accountId)
      setProfile(next)
      setCommitted(next)
      onRefresh()
    } catch {
      setPortabilityOk(false)
      setPortabilityMessage(copy.settings.importInvalid)
    }
  }

  return (
    <div className="wd-panel-stack wd-settings">
      <header className="wd-home-head">
        <div>
          <h2>{copy.settings.title}</h2>
          <p className="wd-lead">{copy.settings.lead}</p>
        </div>
      </header>

      <p className="wd-settings-note">{copy.settings.writingToolsNote}</p>

      <article className="wd-card">
        <header className="wd-settings-card-head">
          <span className="wd-settings-icon" aria-hidden="true">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div>
            <h3>{copy.settings.learningProfile}</h3>
            <p className="wd-muted">{copy.settings.profileHint}</p>
          </div>
        </header>

        <div className="wd-field">
          <span id="wd-level-label">{copy.settings.level}</span>
          <p className="wd-muted" id="wd-level-hint">
            {copy.settings.levelHint}
          </p>
          <div className="wd-level-pills" role="radiogroup" aria-labelledby="wd-level-label" aria-describedby="wd-level-hint">
            <button
              type="button"
              role="radio"
              aria-checked={!profile.level}
              className={`wd-level-pill${!profile.level ? ' is-on' : ''}`}
              onClick={() => setLevel(undefined)}
            >
              {copy.settings.levelUnset}
            </button>
            {LEARNING_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={profile.level === level}
                className={`wd-level-pill${profile.level === level ? ' is-on' : ''}`}
                onClick={() => setLevel(level)}
              >
                {copy.settings.levels[level]}
              </button>
            ))}
          </div>
        </div>

        <fieldset className="wd-fieldset">
          <legend>{copy.settings.focusAreas}</legend>
          <p className="wd-muted">{copy.settings.focusHint}</p>
          <div className="wd-focus-grid">
            {LEARNING_FOCUS_AREAS.map((area) => {
              const item = focusCopy(area, copy)
              const on = profile.focusAreas.includes(area)
              return (
                <button
                  key={area}
                  type="button"
                  className={`wd-focus-tile wd-cat-${area}${on ? ' is-on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggleFocus(area)}
                >
                  <span className="wd-focus-tile-title">{item.title}</span>
                  <span className="wd-muted">{item.hint}</span>
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="wd-settings-save">
          <Button type="button" onClick={onSave} disabled={!dirty}>
            {copy.settings.save}
          </Button>
          {justSaved && !dirty ? (
            <span className="wd-settings-saved">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.settings.saved}
            </span>
          ) : null}
          {dirty ? <span className="wd-settings-dirty">{copy.settings.unsaved}</span> : null}
        </div>
      </article>

      <article className="wd-card">
        <header className="wd-settings-card-head">
          <span className="wd-settings-icon" aria-hidden="true">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <h3>{copy.settings.dataTitle}</h3>
            <p className="wd-muted">{copy.settings.exportImportNote}</p>
          </div>
        </header>

        <div className="wd-settings-transfer">
          <div className="wd-settings-transfer-item">
            <p className="wd-settings-transfer-title">{copy.settings.exportData}</p>
            <p className="wd-muted">{copy.settings.exportHint}</p>
            <Button type="button" variant="secondary" onClick={() => void onExport()}>
              <Download className="h-4 w-4" aria-hidden="true" />
              {copy.settings.exportData}
            </Button>
          </div>
          <div className="wd-settings-transfer-item">
            <p className="wd-settings-transfer-title">{copy.settings.importData}</p>
            <p className="wd-muted">{copy.settings.importHint}</p>
            <label className="wd-check">
              <input
                type="checkbox"
                checked={replaceProfileOnImport}
                onChange={(event) => setReplaceProfileOnImport(event.target.checked)}
              />
              <span>{copy.settings.replaceProfile}</span>
            </label>
            <Button type="button" variant="secondary" onClick={() => importRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {copy.settings.importData}
            </Button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onImportFile(file)
                event.target.value = ''
              }}
            />
          </div>
        </div>
        {portabilityMessage ? (
          <p className={`wd-settings-status${portabilityOk ? ' is-ok' : ' is-bad'}`} role="status">
            {portabilityMessage}
          </p>
        ) : null}
      </article>

      <details className="wd-card wd-danger">
        <summary>
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <span>{copy.settings.dangerTitle}</span>
          <ChevronDown className="wd-danger-chevron h-4 w-4" aria-hidden="true" />
        </summary>
        <p className="wd-muted">{copy.settings.dangerLead}</p>
        <div className="wd-danger-row">
          <div>
            <p className="wd-settings-transfer-title">{copy.settings.resetProfile}</p>
            <p className="wd-muted">{copy.settings.resetHint}</p>
          </div>
          <Button type="button" variant="danger" onClick={onResetProfile}>
            {copy.settings.resetProfile}
          </Button>
        </div>
        <div className="wd-danger-row">
          <div>
            <p className="wd-settings-transfer-title">{copy.settings.clearLocal}</p>
            <p className="wd-muted">{copy.settings.clearHint}</p>
          </div>
          <Button type="button" variant="ghost" onClick={onClearLocal}>
            {copy.settings.clearLocal}
          </Button>
        </div>
      </details>
    </div>
  )
}
