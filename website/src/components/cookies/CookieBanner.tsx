import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMessages } from '../../i18n/index.tsx'
import {
  OPEN_COOKIE_SETTINGS_EVENT,
  acceptAllCookies,
  readCookieConsent,
  rejectOptionalCookies,
  saveCookieSettings,
} from '../../cookies/consent.ts'

export function CookieBanner() {
  const t = useMessages().cookieBanner
  const titleId = useId()
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState(false)
  const [preferences, setPreferences] = useState(true)
  const [product, setProduct] = useState(true)

  useEffect(() => {
    const record = readCookieConsent()
    setReady(true)
    setOpen(!record)
    if (record) {
      setPreferences(record.preferences)
      setProduct(record.product)
    }

    function onOpenSettings() {
      const current = readCookieConsent()
      setPreferences(current?.preferences ?? true)
      setProduct(current?.product ?? true)
      setSettings(true)
      setOpen(true)
    }

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpenSettings)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, onOpenSettings)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (readCookieConsent()) {
        setSettings(false)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!ready || !open) return null

  function closeAfterSave() {
    setSettings(false)
    setOpen(false)
  }

  return (
    <div className="fl-cookie-root">
      <section className="fl-cookie-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <p className="fl-cookie-kicker">{t.kicker}</p>
        <h2 id={titleId} className="fl-cookie-title">
          {t.title}
        </h2>
        <p className="fl-cookie-lead">
          {t.lead}{' '}
          <Link to="/cookies">{t.policy}</Link>
        </p>

        {settings ? (
          <>
            <div className="fl-cookie-panel">
              <label className="fl-cookie-row">
                <span>
                  <h3>{t.necessaryTitle}</h3>
                  <p>{t.necessaryBody}</p>
                </span>
                <span className="fl-cookie-switch">
                  <input type="checkbox" checked disabled aria-label={t.necessaryTitle} />
                  <span />
                </span>
              </label>
              <label className="fl-cookie-row">
                <span>
                  <h3>{t.preferencesTitle}</h3>
                  <p>{t.preferencesBody}</p>
                </span>
                <span className="fl-cookie-switch">
                  <input
                    type="checkbox"
                    checked={preferences}
                    onChange={(event) => setPreferences(event.target.checked)}
                    aria-label={t.preferencesTitle}
                  />
                  <span />
                </span>
              </label>
              <label className="fl-cookie-row">
                <span>
                  <h3>{t.productTitle}</h3>
                  <p>{t.productBody}</p>
                </span>
                <span className="fl-cookie-switch">
                  <input
                    type="checkbox"
                    checked={product}
                    onChange={(event) => setProduct(event.target.checked)}
                    aria-label={t.productTitle}
                  />
                  <span />
                </span>
              </label>
              <label className="fl-cookie-row">
                <span>
                  <h3>{t.analyticsTitle}</h3>
                  <p>{t.analyticsBody}</p>
                </span>
                <span className="fl-cookie-switch">
                  <input type="checkbox" checked={false} disabled aria-label={t.analyticsTitle} />
                  <span />
                </span>
              </label>
            </div>
            <p className="fl-cookie-note">{t.note}</p>
          </>
        ) : null}

        <div className="fl-cookie-actions">
          <button type="button" className="fl-cookie-accept" onClick={() => { acceptAllCookies(); closeAfterSave() }}>
            {t.accept}
          </button>
          <button type="button" className="fl-cookie-reject" onClick={() => { rejectOptionalCookies(); closeAfterSave() }}>
            {t.reject}
          </button>
          {settings ? (
            <button
              type="button"
              className="fl-cookie-settings"
              onClick={() => {
                saveCookieSettings({ preferences, product })
                closeAfterSave()
              }}
            >
              {t.save}
            </button>
          ) : (
            <button type="button" className="fl-cookie-settings" onClick={() => setSettings(true)}>
              {t.settings}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useMessages().cookieBanner
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))}>
      {t.footerSettings}
    </button>
  )
}
