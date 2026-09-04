import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useMessages } from '../i18n/index.tsx'
import {
  hasStoredWebSession,
  loadWebAccount,
  type WebAccountView,
} from '../account/client.ts'
import { probeExtensionBridge } from '../account/extensionBridge.ts'
import { DashboardShell } from '../dashboard/DashboardShell.tsx'
import { DASHBOARD_NAV_GROUPS } from '../dashboard/types.ts'
import { SupportTicketsPanel } from '../components/support/SupportTicketsPanel.tsx'

export function DashboardSupportPage() {
  const messages = useMessages()
  const copy = messages.dashboard
  const [sessionChecking, setSessionChecking] = useState(true)
  const [account, setAccount] = useState<WebAccountView | null>(null)
  const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadWebAccount().then((result) => {
      if (cancelled) return
      if (result.ok) setAccount(result.account)
      setSessionChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void probeExtensionBridge().then(setExtensionConnected)
  }, [])

  const navGroups = useMemo(
    () =>
      DASHBOARD_NAV_GROUPS.map((group) => ({
        label: copy.nav[group.labelKey],
        items: group.items.map((item) => ({
          id: item.id,
          label: copy.nav[item.labelKey],
          href: item.route ?? (item.id === 'support' ? '/dashboard/support' : undefined),
        })),
      })),
    [copy.nav],
  )

  const flatNav = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups])

  if (sessionChecking && hasStoredWebSession()) {
    return (
      <section className="section ac-section ac-section-dashboard">
        <div className="container ac-dash-wide" aria-busy="true">
          <p>{messages.account.loading}</p>
        </div>
      </section>
    )
  }

  if (!account) {
    return <Navigate to="/account" replace />
  }

  return (
    <section className="section ac-section ac-section-dashboard">
      <div className="container ac-dash-wide">
        <DashboardShell
          navGroups={navGroups}
          nav={flatNav}
          section="support"
          onSectionChange={(id) => {
            if (id !== 'support') window.location.assign(`/dashboard#${id}`)
          }}
          extensionConnected={extensionConnected}
        >
          <SupportTicketsPanel />
        </DashboardShell>
      </div>
    </section>
  )
}
