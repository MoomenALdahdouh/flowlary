import { useEffect, useRef, useState } from 'react'
import type { FullLearningReport, LearningReportExportFormat } from '@flowlary/shared'
import type { AccountContextSnapshot } from '../../../storage/activeAccountContext.ts'
import { activeAccountContext } from '../../../storage/activeAccountContext.ts'
import { exportLearningReport } from '../export/exportLearningReport.ts'
import { t } from '../../../popup/i18n/index.ts'

type ReportExportMenuProps = {
  report: FullLearningReport
  accountGuard: AccountContextSnapshot
}

const FORMATS: { id: LearningReportExportFormat; labelKey: 'learningReport.exportPdf' | 'learningReport.exportDocx' | 'learningReport.exportMd' }[] = [
  { id: 'pdf', labelKey: 'learningReport.exportPdf' },
  { id: 'docx', labelKey: 'learningReport.exportDocx' },
  { id: 'md', labelKey: 'learningReport.exportMd' },
]

export function ReportExportMenu({ report, accountGuard }: ReportExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<LearningReportExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  async function runExport(format: LearningReportExportFormat) {
    setError(null)
    setBusy(format)
    setOpen(false)
    try {
      const guard = activeAccountContext.matches(accountGuard) ? accountGuard : activeAccountContext.snapshot()
      const result = await exportLearningReport(report, format, guard)
      if (!result.ok) {
        if (result.error === 'account_changed') setError(t('learningReport.exportAccountChanged'))
        else setError(t('learningReport.exportFailed'))
      }
    } catch {
      setError(t('learningReport.exportFailed'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fl-report-export" ref={menuRef}>
      <button
        type="button"
        className="fl-btn fl-btn-secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy != null}
        onClick={() => setOpen((value) => !value)}
      >
        {busy ? t('learningReport.exportLoading') : t('learningReport.exportMenu')}
      </button>
      {open ? (
        <ul className="fl-report-export-menu" role="menu" aria-label={t('learningReport.exportMenu')}>
          {FORMATS.map((item) => (
            <li key={item.id} role="none">
              <button type="button" role="menuitem" className="fl-report-export-item" onClick={() => void runExport(item.id)}>
                {t(item.labelKey)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="fl-report-export-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
