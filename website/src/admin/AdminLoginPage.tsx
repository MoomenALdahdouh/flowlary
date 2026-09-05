import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Button } from '../components/Ui.tsx'
import { Logo } from '../components/Logo.tsx'
import { LocaleSwitcher } from '../bolt/components/layout/Navbar.tsx'
import { ThemeToggle } from '../components/ThemeToggle.tsx'
import { useI18n, useMessages } from '../i18n/index.tsx'
import { loginWebAccount, logoutWebAccount, peekWebSession } from '../account/client.ts'
import { fetchAdminSession } from './client.ts'

export function AdminLoginPage() {
  const t = useMessages()
  const { locale, setLocale } = useI18n()
  const copy = t.adminPanel.login
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<'auth' | 'forbidden' | 'network' | 'unavailable' | null>(null)

  useEffect(() => {
    if (!peekWebSession()) return
    void fetchAdminSession().then((res) => {
      if (res.ok) navigate('/admin', { replace: true })
    })
  }, [navigate])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const login = await loginWebAccount(email.trim(), password)
    if (!login.ok) {
      setBusy(false)
      setError(login.error === 'network' ? 'network' : login.error === 'unavailable' ? 'unavailable' : 'auth')
      return
    }
    const admin = await fetchAdminSession()
    if (!admin.ok) {
      await logoutWebAccount()
      setBusy(false)
      setError(admin.status === 403 ? 'forbidden' : admin.status === 0 ? 'network' : 'auth')
      return
    }
    setBusy(false)
    navigate('/admin', { replace: true })
  }

  const errorMessage =
    error === 'forbidden'
      ? copy.errorForbidden
      : error === 'network'
        ? copy.errorNetwork
        : error === 'unavailable'
          ? copy.errorUnavailable
          : error
            ? copy.errorAuth
            : null

  return (
    <section className="ad-login">
      <div className="ad-login-card wd-card">
        <header className="ad-login-head">
          <Logo className="ad-brand-mark" />
          <p className="wd-data-label">{copy.kicker}</p>
          <h1>{copy.title}</h1>
          <p className="wd-lead">{copy.lead}</p>
        </header>
        <form className="ad-login-form" onSubmit={(event) => void onSubmit(event)}>
          {errorMessage ? (
            <p className="ad-login-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <label className="wd-field">
            <span>{copy.email}</span>
            <span className="ad-login-input">
              <Mail className="h-4 w-4" aria-hidden="true" />
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
              />
            </span>
          </label>
          <label className="wd-field">
            <span>{copy.password}</span>
            <span className="ad-login-input">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="ad-login-eye"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t.account.hidePassword : t.account.showPassword}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          <Button type="submit" disabled={busy || !email.trim() || password.length < 8} aria-busy={busy}>
            {busy ? copy.signingIn : copy.submit}
          </Button>
        </form>
        <p className="ad-login-foot">
          <Link to="/">{t.adminPanel.backToSite}</Link>
          <span className="wd-nav-utils">
            <LocaleSwitcher locale={locale} setLocale={setLocale} />
            <ThemeToggle />
          </span>
        </p>
      </div>
    </section>
  )
}
