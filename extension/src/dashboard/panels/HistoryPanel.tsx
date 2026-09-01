import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HistoryEntry, HistoryOperation } from '@flowlary/shared'
import {
  clearAllHistory,
  deleteHistoryEntry,
  fetchHistory,
  PopupApiError,
} from '../../popup/api.ts'
import {
  formatHistoryTimestamp,
  historyMetaLine,
  operationLabel,
  truncateHistoryText,
} from '../../popup/history.ts'
import { t } from '../../popup/i18n/index.ts'
import { ConfirmDialog } from '../../ui/shared.tsx'
import { HistoryInlineDiff } from '../components/HistoryInlineDiff.tsx'

type HistoryPanelProps = {
  busy: string | null
  setBusy: (value: string | null) => void
  setError: (value: string | null) => void
  embedded?: boolean
  /** When true, omit title and lead — parent page already provides them. */
  hideHeader?: boolean
}

type HistoryFilter = 'all' | HistoryOperation

function operationTag(operation: HistoryOperation): string {
  switch (operation) {
    case 'CORRECT':
      return t('activity.filterCorrection').replace(/s$/, '').toUpperCase()
    case 'TRANSLATE':
      return t('activity.filterTranslation').toUpperCase()
    case 'FIX_LAYOUT':
      return t('activity.filterLayout').toUpperCase()
    default:
      return operation
  }
}

export function HistoryPanel({
  busy,
  setBusy,
  setError,
  embedded = false,
  hideHeader = false,
}: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [confirmClear, setConfirmClear] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetchHistory()
      setEntries(response.entries)
    } catch (err) {
      setError(err instanceof PopupApiError ? err.message : t('errors.loadHistory'))
    } finally {
      setLoading(false)
    }
  }, [setError])

  useEffect(() => {
    void reload()
  }, [reload])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (filter !== 'all' && entry.operation !== filter) return false
      if (!q) return true
      const haystack = [
        entry.sourceText,
        entry.resultText,
        entry.domain ?? '',
        operationLabel(entry.operation),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [entries, filter, query])

  async function runHistoryAction(key: string, fn: () => Promise<{ entries: HistoryEntry[] }>) {
    setBusy(key)
    setError(null)
    try {
      const response = await fn()
      setEntries(response.entries)
    } catch (err) {
      setError(err instanceof PopupApiError ? err.message : t('errors.historyAction'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      className={`fl-section fl-history${embedded ? ' fl-history-embedded' : ''}`}
      aria-labelledby="activity-heading"
    >
      {!hideHeader || entries.length > 0 ? (
        <div className={`fl-history-toolbar${hideHeader ? ' is-compact' : ''}`}>
          {!hideHeader ? (
            <div>
              {embedded ? (
                <h3 id="activity-heading" className="fl-block-title">
                  {t('activity.title')}
                </h3>
              ) : (
                <h2 id="activity-heading" className="fl-dash-page-title">
                  {t('activity.title')}
                </h2>
              )}
              <p className="fl-history-local-note">{t('activity.localNote')}</p>
            </div>
          ) : (
            <span id="activity-heading" className="visually-hidden">
              {t('activity.title')}
            </span>
          )}
          {entries.length > 0 ? (
            <button type="button" className="fl-link-btn" onClick={() => setConfirmClear(true)}>
              {t('activity.clearAll')}
            </button>
          ) : null}
        </div>
      ) : (
        <span id="activity-heading" className="visually-hidden">
          {t('activity.title')}
        </span>
      )}

      <div className="fl-history-controls">
        <input
          type="search"
          className="fl-history-search"
          placeholder={t('activity.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('activity.search')}
        />
        <div className="fl-history-filters" role="tablist" aria-label={t('activity.title')}>
          {(
            [
              ['all', t('activity.filterAll')],
              ['CORRECT', t('activity.filterCorrection')],
              ['TRANSLATE', t('activity.filterTranslation')],
              ['FIX_LAYOUT', t('activity.filterLayout')],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={`fl-history-filter${filter === value ? ' is-active' : ''}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="fl-card-desc">{t('activity.loading')}</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className="fl-history-empty">{t('activity.empty')}</p>
      ) : null}

      <ul className="fl-history-list fl-history-list-compact">
        {filtered.map((entry) => {
          const meta = historyMetaLine(entry)
          return (
            <li key={entry.id} className="fl-history-item fl-history-item-compact">
              <div className="fl-history-item-head">
                <strong className="fl-history-op">{operationTag(entry.operation)}</strong>
                <span className="fl-history-site">{entry.domain ?? '—'}</span>
                <time dateTime={new Date(entry.timestamp).toISOString()}>
                  {formatHistoryTimestamp(entry.timestamp)}
                </time>
              </div>
              {meta ? <p className="fl-history-meta">{meta}</p> : null}
              {entry.operation === 'TRANSLATE' ? (
                <p className="fl-history-diff">
                  <span>{truncateHistoryText(entry.sourceText, 80)}</span>
                  <span aria-hidden> → </span>
                  <span>{truncateHistoryText(entry.resultText, 80)}</span>
                </p>
              ) : (
                <HistoryInlineDiff original={entry.sourceText} corrected={entry.resultText} />
              )}
              <button
                type="button"
                className="fl-link-btn"
                disabled={busy === `delete-${entry.id}`}
                onClick={() =>
                  void runHistoryAction(`delete-${entry.id}`, () => deleteHistoryEntry(entry.id))
                }
              >
                {t('activity.delete')}
              </button>
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={confirmClear}
        title={t('activity.clearConfirmTitle')}
        description={t('activity.clearConfirmDesc')}
        confirmLabel={t('activity.clearConfirmAction')}
        busy={busy === 'clear-history'}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          void runHistoryAction('clear-history', clearAllHistory).then(() => setConfirmClear(false))
        }}
      />
    </section>
  )
}
