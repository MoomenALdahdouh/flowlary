import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import { API_URL } from '../config.ts'

export function ForgotPasswordPage() {
  const t = useMessages()
  const copy = t.account
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!response.ok && response.status === 503) {
        setError(copy.errorUnavailable)
        return
      }
      setSent(true)
    } catch {
      setError(copy.errorNetwork)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ac-page ac-page-signed-out">
      <section className="section ac-section">
        <div className="container ac-auth-shell">
          <p className="ac-kicker">{copy.kicker}</p>
          <h1>{copy.forgotPasswordTitle}</h1>
          <p className="ac-lead">{copy.forgotPasswordLead}</p>

          <article className="ac-auth-card">
            {sent ? (
              <p className="ac-alert is-ok" role="status">
                {copy.forgotPasswordSent}
              </p>
            ) : (
              <form className="ac-form" noValidate onSubmit={onSubmit}>
                <label className="ac-field" htmlFor="fp-email">
                  <span>{copy.emailLabel}</span>
                  <input
                    id="fp-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={busy}
                    aria-describedby={error ? 'fp-error' : undefined}
                  />
                </label>
                {error ? (
                  <div className="ac-alert" id="fp-error" role="alert">
                    <p>{error}</p>
                  </div>
                ) : null}
                <Button type="submit" className="ac-submit" disabled={busy} aria-busy={busy}>
                  {busy ? copy.submittingReset : copy.forgotPasswordSubmit}
                </Button>
              </form>
            )}
          </article>

          <p className="ac-switch">
            <Link className="ac-link" to="/account">
              {copy.backToSignIn}
            </Link>
          </p>
        </div>
      </section>
    </div>
  )
}
