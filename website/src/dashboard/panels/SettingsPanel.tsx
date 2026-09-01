import { useRef, useState } from 'react'
import {
  LEARNING_FOCUS_AREAS,
  LEARNING_LEVELS,
  type LearningFocus,
  type LearningLevel,
} from '@flowlary/shared'
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

export function SettingsPanel({ accountId, copy, onRefresh }: SettingsPanelProps) {
  const [profile, setProfile] = useState(() => readLearningProfile(accountId))
  const [saved, setSaved] = useState(false)
  const [replaceProfileOnImport, setReplaceProfileOnImport] = useState(true)
  const [portabilityMessage, setPortabilityMessage] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  function toggleFocus(area: LearningFocus) {
    const next = profile.focusAreas.includes(area)
      ? profile.focusAreas.filter((item) => item !== area)
      : [...profile.focusAreas, area]
    setProfile({ ...profile, focusAreas: next.length > 0 ? next : [area], updatedAt: Date.now() })
    setSaved(false)
  }

  function onSave() {
    const next = { ...profile, updatedAt: Date.now() }
    setProfile(next)
    void saveWebLearningProfile(accountId, next)
    setSaved(true)
    onRefresh()
  }

  function onResetProfile() {
    const next = resetWebLearningProfile(accountId)
    setProfile(next)
    void saveWebLearningProfile(accountId, next)
    setSaved(true)
    onRefresh()
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
    setPortabilityMessage(copy.settings.exportReady)
  }

  async function onImportFile(file: File) {
    try {
      const raw = await file.text()
      const payload = parseWebLearningExport(raw)
      await importWebLearningExport(accountId, payload, { replaceProfile: replaceProfileOnImport })
      setPortabilityMessage(copy.settings.importReady)
      onRefresh()
    } catch {
      setPortabilityMessage(copy.settings.importInvalid)
    }
  }

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.settings.title}</h2>
        <p className="wd-lead">{copy.settings.lead}</p>
      </header>

      <article className="wd-card">
        <h3>{copy.settings.learningProfile}</h3>
        <label className="wd-field">
          <span>{copy.settings.level}</span>
          <select
            value={profile.level ?? ''}
            onChange={(event) => {
              const value = event.target.value as LearningLevel | ''
              setProfile({ ...profile, level: value || undefined, updatedAt: Date.now() })
              setSaved(false)
            }}
          >
            <option value="">—</option>
            {LEARNING_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="wd-fieldset">
          <legend>{copy.settings.focusAreas}</legend>
          {LEARNING_FOCUS_AREAS.map((area) => (
            <label key={area} className="wd-check">
              <input
                type="checkbox"
                checked={profile.focusAreas.includes(area)}
                onChange={() => toggleFocus(area)}
              />
              <span>{area}</span>
            </label>
          ))}
        </fieldset>

        <div className="wd-actions">
          <Button type="button" onClick={onSave}>
            {copy.settings.save}
          </Button>
          {saved ? <span className="wd-muted">{copy.settings.saved}</span> : null}
        </div>
      </article>

      <article className="wd-card">
        <h3>{copy.settings.exportData}</h3>
        <p className="wd-muted">{copy.settings.exportImportNote}</p>
        <label className="wd-check">
          <input
            type="checkbox"
            checked={replaceProfileOnImport}
            onChange={(event) => setReplaceProfileOnImport(event.target.checked)}
          />
          <span>{copy.settings.replaceProfile}</span>
        </label>
        <div className="wd-actions wd-actions-wrap">
          <Button type="button" variant="secondary" onClick={() => void onExport()}>
            {copy.settings.exportData}
          </Button>
          <Button type="button" variant="secondary" onClick={() => importRef.current?.click()}>
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
        {portabilityMessage ? <p className="wd-muted">{portabilityMessage}</p> : null}
        <div className="wd-actions">
          <Button type="button" variant="ghost" onClick={onResetProfile}>
            {copy.settings.resetProfile}
          </Button>
          <Button type="button" variant="ghost" onClick={onClearLocal}>
            {copy.settings.clearLocal}
          </Button>
        </div>
      </article>
    </div>
  )
}
