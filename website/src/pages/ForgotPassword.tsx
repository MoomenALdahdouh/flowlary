import { useState } from 'react'
import { Button } from '../components/Ui.tsx'
import { AccountAuthLayout } from '../components/account/AccountAuthLayout.tsx'
import { useMessages } from '../i18n/index.tsx'
import { API_URL } from '../config.ts'
import { Mail } from 'lucide-react'

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
    <AccountAuthLayout
      kicker={copy.kicker}
      title={copy.forgotPasswordTitle}
      titleHighlight="password"
      lead={copy.forgotPasswordLead}
      trustLine={copy.trustLine}
    >
      <article>
        {sent ? (
          <div className="ac-alert is-ok" role="status">
            <p>{copy.forgotPasswordSent}</p>
          </div>
        ) : (
          <form className="ac-form" noValidate onSubmit={onSubmit}>
            <label className="ac-field" htmlFor="fp-email">
              <span>{copy.emailLabel}</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  id="fp-email"
                  className="field-input ps-10"
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
              </span>
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
        <Button variant="link" to="/account">
          {copy.backToSignIn}
        </Button>
      </p>
    </AccountAuthLayout>
  )
}
