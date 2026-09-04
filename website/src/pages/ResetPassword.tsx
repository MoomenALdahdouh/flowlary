import { useState } from 'react'
import { Button } from '../components/Ui.tsx'
import { AccountAuthLayout } from '../components/account/AccountAuthLayout.tsx'
import { useMessages } from '../i18n/index.tsx'
import { API_URL } from '../config.ts'
import { useSearchParams } from 'react-router-dom'

export function ResetPasswordPage() {
  const t = useMessages()
  const copy = t.account
  const [search] = useSearchParams()
  const token = search.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password !== confirm) {
      setError(copy.errorPasswordMismatch)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        if (body.error === 'expired_token') setError(copy.resetPasswordExpired)
        else if (body.error === 'invalid_password') setError(copy.errorPasswordShort)
        else setError(copy.resetPasswordInvalid)
        return
      }
      setDone(true)
    } catch {
      setError(copy.errorNetwork)
    } finally {
      setBusy(false)
    }
  }

  function invalidPanel(message: string) {
    return (
      <AccountAuthLayout
        kicker={copy.kicker}
        title={copy.resetPasswordTitle}
        titleHighlight="password"
        lead={copy.resetPasswordLead}
        trustLine={copy.trustLine}
      >
        <article className="ac-auth-card">
          <div className="ac-alert" role="alert">
            <p>{message}</p>
          </div>
          <div className="ac-actions">
            <Button variant="secondary" to="/account/forgot-password">
              {copy.forgotPasswordTitle}
            </Button>
            <Button variant="ghost" to="/account">
              {copy.backToSignIn}
            </Button>
          </div>
        </article>
      </AccountAuthLayout>
    )
  }

  if (!token) {
    return invalidPanel(copy.resetPasswordInvalid)
  }

  return (
    <AccountAuthLayout
      kicker={copy.kicker}
      title={copy.resetPasswordTitle}
      titleHighlight="password"
      lead={copy.resetPasswordLead}
      trustLine={copy.trustLine}
    >
      <article>
        {done ? (
          <>
            <div className="ac-alert is-ok" role="status">
              <p>{copy.resetPasswordDone}</p>
            </div>
            <div className="ac-actions">
              <Button to="/account">{copy.backToSignIn}</Button>
            </div>
          </>
        ) : (
          <form className="ac-form" noValidate onSubmit={onSubmit}>
            <label className="ac-field" htmlFor="rp-password">
              <span>{copy.newPasswordLabel}</span>
              <div className="ac-input-wrap">
                <input
                  id="rp-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  disabled={busy}
                  aria-describedby="rp-password-hint"
                />
                <button
                  type="button"
                  className="ac-toggle-pw ac-toggle-pw-inline"
                  aria-pressed={showPassword}
                  aria-controls="rp-password"
                  aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? copy.hidePassword : copy.showPassword}
                </button>
              </div>
            </label>
            <p id="rp-password-hint" className="ac-hint">
              {copy.passwordHint}
            </p>
            <label className="ac-field" htmlFor="rp-confirm">
              <span>{copy.confirmPasswordLabel}</span>
              <div className="ac-input-wrap">
                <input
                  id="rp-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={8}
                  required
                  disabled={busy}
                  aria-describedby={error ? 'rp-error' : undefined}
                />
                <button
                  type="button"
                  className="ac-toggle-pw ac-toggle-pw-inline"
                  aria-pressed={showConfirm}
                  aria-controls="rp-confirm"
                  aria-label={showConfirm ? copy.hidePassword : copy.showPassword}
                  onClick={() => setShowConfirm((value) => !value)}
                >
                  {showConfirm ? copy.hidePassword : copy.showPassword}
                </button>
              </div>
            </label>
            {error ? (
              <div className="ac-alert" id="rp-error" role="alert">
                <p>{error}</p>
              </div>
            ) : null}
            <Button type="submit" className="ac-submit" disabled={busy} aria-busy={busy}>
              {busy ? copy.submittingReset : copy.resetPasswordSubmit}
            </Button>
          </form>
        )}
      </article>

      {!done ? (
        <p className="ac-switch">
          <Button variant="link" to="/account">
            {copy.backToSignIn}
          </Button>
        </p>
      ) : null}
    </AccountAuthLayout>
  )
}
