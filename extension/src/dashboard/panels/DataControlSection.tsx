import { useEffect, useRef, useState } from 'react'
import type { DataImportPreview, DataSummary } from '@flowlary/shared'
import type { ExtensionStatus } from '../../messaging/types.ts'
import {
  clearAllHistory,
  clearLearningHistory,
  exportUserData,
  fetchDataSummary,
  importUserData,
  previewDataImport,
  resetFlowlaryLocal,
  resetLearningProfile,
  restartLearningOnboarding,
} from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import { ConfirmDialog } from '../../ui/shared.tsx'
import { getUpgradeUrl } from '../../config/upgrade.ts'

type DataControlSectionProps = {
  status: ExtensionStatus
  busy: string | null
  onMutate: (key: string, fn: () => Promise<unknown>) => Promise<void>
  onOpenActivity: () => void
  onOpenProgress: () => void
  onRestartOnboarding: () => void
  onStatusRefresh: () => Promise<ExtensionStatus>
  onStatus: (status: ExtensionStatus) => void
}

function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function humanizeImportError(code: string): string {
  switch (code) {
    case 'invalid_json':
    case 'invalid_schema':
    case 'invalid_product':
      return t('dataControl.importInvalid')
    case 'unsupported_version':
      return t('dataControl.importUnsupported')
    case 'import_too_large':
      return t('dataControl.importTooLarge')
    default:
      return t('dataControl.importFailed')
  }
}

export function DataControlSection({
  status,
  busy,
  onMutate,
  onOpenActivity,
  onOpenProgress,
  onRestartOnboarding,
  onStatusRefresh,
  onStatus,
}: DataControlSectionProps) {
  const canExport =
    status.entitlement.capabilities.includes('learning.export') ||
    status.entitlement.isPro ||
    status.entitlement.inTrial
  const canImport =
    status.entitlement.capabilities.includes('learning.import') ||
    status.entitlement.isPro ||
    status.entitlement.inTrial
  const [summary, setSummary] = useState<DataSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [clearActivityOpen, setClearActivityOpen] = useState(false)
  const [clearLearningOpen, setClearLearningOpen] = useState(false)
  const [resetProfileOpen, setResetProfileOpen] = useState(false)
  const [resetFlowlaryOpen, setResetFlowlaryOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [importPreview, setImportPreview] = useState<DataImportPreview | null>(null)
  const [importRaw, setImportRaw] = useState<string | null>(null)
  const [replaceProfile, setReplaceProfile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function reloadSummary() {
    const next = await fetchDataSummary()
    setSummary(next)
    return next
  }

  useEffect(() => {
    let active = true
    void fetchDataSummary()
      .then((data) => {
        if (active) setSummary(data)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleExport() {
    setMessage(null)
    const response = await exportUserData()
    if (!response.ok || !('json' in response)) {
      setMessage(t('dataControl.exportFailed'))
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadJson(`flowlary-export-${stamp}.json`, response.json)
    setMessage(t('dataControl.exportSuccess'))
  }

  async function handleFilePick(file: File) {
    setMessage(null)
    setImportPreview(null)
    setImportRaw(null)
    const raw = await file.text()
    const preview = await previewDataImport(raw)
    if (!preview.ok || !('preview' in preview)) {
      setMessage(humanizeImportError(preview.error ?? 'import_failed'))
      return
    }
    setImportRaw(raw)
    setImportPreview(preview.preview)
    setReplaceProfile(false)
  }

  async function handleImportConfirm() {
    if (!importRaw) return
    setMessage(null)
    const response = await importUserData(importRaw, replaceProfile)
    if (!response.ok) {
      setMessage(humanizeImportError(response.error ?? 'import_failed'))
      return
    }
    setImportPreview(null)
    setImportRaw(null)
    await reloadSummary()
    setMessage(t('dataControl.importSuccess'))
  }

  if (loading || !summary) {
    return <p className="fl-loading" role="status">{t('connection.checking')}</p>
  }

  return (
    <section className="fl-section fl-data-control" aria-labelledby="data-control-heading">
      <h2 id="data-control-heading" className="fl-section-label">{t('dataControl.title')}</h2>
      <p className="fl-card-desc">{t('dataControl.lead')}</p>

      {message ? (
        <p className="fl-card-desc" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}

      <div className="fl-dash-card fl-data-summary">
        <h3 className="fl-section-label">{t('dataControl.summaryTitle')}</h3>
        <dl className="fl-data-summary-list">
          <div>
            <dt>{t('dataControl.activityLabel')}</dt>
            <dd>
              {summary.activityCount > 0
                ? t('dataControl.records', { count: String(summary.activityCount) })
                : t('dataControl.emptyActivity')}
            </dd>
          </div>
          <div>
            <dt>{t('dataControl.learningLabel')}</dt>
            <dd>
              {summary.learningEventCount > 0
                ? t('dataControl.events', { count: String(summary.learningEventCount) })
                : t('dataControl.emptyLearning')}
            </dd>
          </div>
          <div>
            <dt>{t('dataControl.practiceLabel')}</dt>
            <dd>
              {summary.practiceSessionCount > 0
                ? t('dataControl.sessions', { count: String(summary.practiceSessionCount) })
                : t('dataControl.emptyPractice')}
            </dd>
          </div>
          <div>
            <dt>{t('dataControl.profileLabel')}</dt>
            <dd>
              {summary.profileConfigured
                ? t('dataControl.profileConfigured')
                : t('dataControl.emptyProfile')}
            </dd>
          </div>
        </dl>
      </div>

      <div className="fl-data-control-group">
        <h3 className="fl-section-label">{t('dataControl.activityLabel')}</h3>
        <div className="fl-data-control-actions">
          <button type="button" className="fl-link-btn" onClick={onOpenActivity}>
            {t('dataControl.viewActivity')}
          </button>
          <button type="button" className="fl-link-btn" onClick={() => setClearActivityOpen(true)}>
            {t('dataControl.clearActivity')}
          </button>
        </div>
      </div>

      <div className="fl-data-control-group">
        <h3 className="fl-section-label">{t('dataControl.learningLabel')}</h3>
        <div className="fl-data-control-actions">
          <button type="button" className="fl-link-btn" onClick={onOpenProgress}>
            {t('dataControl.viewLearning')}
          </button>
          <button type="button" className="fl-link-btn" onClick={() => setClearLearningOpen(true)}>
            {t('dataControl.clearLearning')}
          </button>
        </div>
      </div>

      <div className="fl-data-control-group">
        <h3 className="fl-section-label">{t('dataControl.profileLabel')}</h3>
        <div className="fl-data-control-actions">
          <button type="button" className="fl-link-btn" onClick={() => window.location.hash = 'settings'}>
            {t('dataControl.editProfile')}
          </button>
          <button type="button" className="fl-link-btn" onClick={() => setResetProfileOpen(true)}>
            {t('dataControl.resetProfile')}
          </button>
          <button
            type="button"
            className="fl-link-btn"
            disabled={busy === 'learning-restart'}
            onClick={() =>
              void onMutate('learning-restart', async () => {
                await restartLearningOnboarding()
                onRestartOnboarding()
              })
            }
          >
            {t('dataControl.restartOnboarding')}
          </button>
        </div>
      </div>

      <div className="fl-data-control-group">
        <h3 className="fl-section-label">{t('dataControl.exportData')}</h3>
        {canExport ? (
          <div className="fl-data-control-actions">
            <button
              type="button"
              className="fl-action-btn"
              disabled={busy === 'export-data'}
              onClick={() => void onMutate('export-data', handleExport)}
            >
              {t('dataControl.exportData')}
            </button>
            {canImport ? (
              <label className="fl-action-btn fl-import-label">
                {t('dataControl.importData')}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="fl-sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleFilePick(file)
                    event.target.value = ''
                  }}
                />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="fl-dash-card fl-upgrade-teaser" role="status">
            <p className="fl-card-desc">{t('dataControl.exportProOnly')}</p>
            <a className="fl-action-btn fl-action-btn-primary" href={getUpgradeUrl()} target="_blank" rel="noreferrer">
              {t('dataControl.upgradeForExport')}
            </a>
          </div>
        )}
      </div>

      {importPreview ? (
        <div className="fl-dash-card fl-import-preview" role="dialog" aria-labelledby="import-preview-title">
          <h3 id="import-preview-title" className="fl-section-label">
            {t('dataControl.importPreviewTitle')}
          </h3>
          <ul className="fl-import-preview-list">
            {importPreview.profileCount > 0 ? (
              <li>{t('dataControl.importPreviewProfile', { count: String(importPreview.profileCount) })}</li>
            ) : null}
            {importPreview.learningEventCount > 0 ? (
              <li>{t('dataControl.importPreviewEvents', { count: String(importPreview.learningEventCount) })}</li>
            ) : null}
            {importPreview.practiceSessionCount > 0 ? (
              <li>{t('dataControl.importPreviewSessions', { count: String(importPreview.practiceSessionCount) })}</li>
            ) : null}
            {importPreview.activityCount > 0 ? (
              <li>{t('dataControl.importPreviewActivity', { count: String(importPreview.activityCount) })}</li>
            ) : null}
          </ul>
          {importPreview.profileCount > 0 ? (
            <label className="fl-onboarding-chip">
              <input
                type="checkbox"
                checked={replaceProfile}
                onChange={(event) => setReplaceProfile(event.target.checked)}
              />
              <span>{t('dataControl.importReplaceProfile')}</span>
            </label>
          ) : null}
          <div className="fl-data-control-actions">
            <button type="button" className="fl-action-btn" onClick={() => void handleImportConfirm()}>
              {t('dataControl.importConfirm')}
            </button>
            <button
              type="button"
              className="fl-link-btn"
              onClick={() => {
                setImportPreview(null)
                setImportRaw(null)
              }}
            >
              {t('dataControl.importCancel')}
            </button>
          </div>
        </div>
      ) : null}

      <div className="fl-dash-card fl-data-danger">
        <h3 className="fl-section-label">{t('dataControl.dangerTitle')}</h3>
        <p className="fl-card-desc">{t('dataControl.resetDesc')}</p>
        <button type="button" className="fl-action-btn is-danger" onClick={() => setResetFlowlaryOpen(true)}>
          {t('dataControl.resetTitle')}
        </button>
        <p className="fl-card-desc">{t('dataControl.accountDeleteUnavailable')}</p>
      </div>

      <ConfirmDialog
        open={clearActivityOpen}
        title={t('dataControl.clearActivityTitle')}
        description={t('dataControl.clearActivityDesc')}
        confirmLabel={t('dataControl.clearActivityAction')}
        busy={busy === 'clear-activity'}
        onCancel={() => setClearActivityOpen(false)}
        onConfirm={() => {
          void onMutate('clear-activity', async () => {
            await clearAllHistory()
            await reloadSummary()
            setClearActivityOpen(false)
          })
        }}
      />

      <ConfirmDialog
        open={clearLearningOpen}
        title={t('dataControl.clearLearningTitle')}
        description={t('dataControl.clearLearningDesc')}
        confirmLabel={t('dataControl.clearLearningAction')}
        busy={busy === 'clear-learning'}
        onCancel={() => setClearLearningOpen(false)}
        onConfirm={() => {
          void onMutate('clear-learning', async () => {
            await clearLearningHistory()
            await reloadSummary()
            setClearLearningOpen(false)
          })
        }}
      />

      <ConfirmDialog
        open={resetProfileOpen}
        title={t('learning.resetConfirmTitle')}
        description={t('learning.resetConfirmDesc')}
        confirmLabel={t('learning.resetConfirmAction')}
        busy={busy === 'reset-profile'}
        onCancel={() => setResetProfileOpen(false)}
        onConfirm={() => {
          void onMutate('reset-profile', async () => {
            await resetLearningProfile()
            await onStatusRefresh()
            await reloadSummary()
            setResetProfileOpen(false)
          })
        }}
      />

      {resetFlowlaryOpen ? (
        <div className="fl-dialog-backdrop" role="presentation" onClick={() => setResetFlowlaryOpen(false)}>
          <div
            className="fl-dialog"
            role="alertdialog"
            aria-labelledby="reset-flowlary-title"
            aria-describedby="reset-flowlary-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="reset-flowlary-title" className="fl-dialog-title">
              {t('dataControl.resetConfirmTitle')}
            </h3>
            <p id="reset-flowlary-desc" className="fl-dialog-desc">
              {t('dataControl.resetConfirmDesc')}
            </p>
            <label className="fl-account-field">
              <span>{t('dataControl.resetConfirmPlaceholder')}</span>
              <input
                type="text"
                value={resetConfirmText}
                autoComplete="off"
                onChange={(event) => setResetConfirmText(event.target.value)}
              />
            </label>
            <div className="fl-dialog-actions">
              <button type="button" className="fl-action-btn" onClick={() => setResetFlowlaryOpen(false)}>
                {t('dialog.cancel')}
              </button>
              <button
                type="button"
                className="fl-action-btn is-danger"
                disabled={resetConfirmText !== 'RESET' || busy === 'reset-flowlary'}
                onClick={() => {
                  void onMutate('reset-flowlary', async () => {
                    const next = await resetFlowlaryLocal()
                    onStatus(next)
                    setResetConfirmText('')
                    setResetFlowlaryOpen(false)
                    await reloadSummary()
                  })
                }}
              >
                {t('dataControl.resetConfirmAction')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
