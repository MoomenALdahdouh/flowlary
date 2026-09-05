import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import { hasStoredWebSession, loadWebAccount, logoutWebAccount, type WebAccountView } from '../account/client.ts'
import { fetchAdminSession } from './client.ts'
import { AdminShell } from './AdminShell.tsx'

export function AdminLayout() {
  const t = useMessages()
  const copy = t.adminPanel
  const [checking, setChecking] = useState(true)
  const [account, setAccount] = useState<WebAccountView | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState(false)

  async function bootstrap() {
    setChecking(true)
    setError(false)
    const loaded = await loadWebAccount()
    if (!loaded.ok || !loaded.account) {
      setAccount(null)
      setAdminEmail(null)
      setChecking(false)
      return
    }
    setAccount(loaded.account)
    const session = await fetchAdminSession()
    if (session.ok) {
      setAdminEmail(session.body.admin.email)
      setForbidden(false)
    } else if (session.status === 403) {
      setForbidden(true)
      setAdminEmail(null)
    } else if (session.status === 401) {
      setAccount(null)
      setAdminEmail(null)
    } else {
      setError(true)
    }
    setChecking(false)
  }

  useEffect(() => {
    void bootstrap()
  }, [])

  if (checking && hasStoredWebSession()) {
    return (
      <section className="ad-login">
        <div className="ad-login-card wd-card">
          <h1>{copy.title}</h1>
          <p role="status">{copy.loading}</p>
        </div>
      </section>
    )
  }

  if (!account) {
    return <Navigate to="/admin/login" replace />
  }

  if (error) {
    return (
      <section className="ad-login">
        <div className="ad-login-card wd-card">
          <h1>{copy.title}</h1>
          <p role="alert">{copy.error}</p>
          <Button type="button" onClick={() => void bootstrap()}>
            {copy.retry}
          </Button>
        </div>
      </section>
    )
  }

  if (forbidden || !adminEmail) {
    return (
      <section className="ad-login">
        <div className="ad-login-card wd-card">
          <h1>{copy.title}</h1>
          <p role="alert">{copy.forbidden}</p>
          <Button
            type="button"
            onClick={() => {
              void logoutWebAccount().then(() => {
                setAccount(null)
              })
            }}
          >
            {copy.login.submit}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <AdminShell
      email={adminEmail}
      onLogout={() => {
        void logoutWebAccount()
        setAccount(null)
      }}
    >
      <Outlet />
    </AdminShell>
  )
}
