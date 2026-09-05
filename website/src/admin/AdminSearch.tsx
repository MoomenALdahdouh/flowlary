import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AdminSearchHit } from '@flowlary/shared'
import { fetchAdminSearch } from './client.ts'
import { useMessages } from '../i18n/index.tsx'

export function AdminSearch() {
  const t = useMessages().adminPanel
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<AdminSearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      setSearched(false)
      return
    }
    const handle = window.setTimeout(() => {
      void fetchAdminSearch(query.trim()).then((res) => {
        if (res.ok) {
          setHits(res.body.items)
          setSearched(true)
          setOpen(true)
        }
      })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault()
        document.getElementById('ad-global-search')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="ad-search">
      <label className="sr-only" htmlFor="ad-global-search">
        {t.searchAria}
      </label>
      <input
        id="ad-global-search"
        type="search"
        value={query}
        placeholder={t.search}
        autoComplete="off"
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => (hits.length > 0 || searched) && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && searched ? (
        <ul className="ad-search-results" role="listbox">
          {hits.length === 0 ? (
            <li className="ad-search-empty">{t.searchNoResults}</li>
          ) : (
            hits.map((hit) => (
              <li key={`${hit.type}-${hit.id}`}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false)
                    setQuery('')
                    navigate(hit.href)
                  }}
                >
                  <strong>{hit.title}</strong>
                  <span>{hit.type} · {hit.subtitle}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
