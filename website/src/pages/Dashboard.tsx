import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import {
  fetchBillingConfig,
  hasStoredWebSession,
  loadWebAccount,
  logoutWebAccount,
  type BillingConfigView,
  type WebAccountView,
  type WebEntitlementView,
} from '../account/client.ts'
import { beginProCheckout, openBillingPortal } from '../account/billing.ts'
import { syncStoredSessionToExtension, probeExtensionBridge } from '../account/extensionBridge.ts'
import { bootstrapWebLearningSync } from '../lab/webLearningSync.ts'
import { DashboardApp } from '../dashboard/DashboardApp.tsx'
import { buildWorkspaceBillingProps } from '../account/workspaceBilling.ts'
import { StudentVerificationPanel } from '../account/StudentVerificationPanel.tsx'

export function DashboardPage() {
  const t = useMessages()
  const copy = t.account
  const [search] = useSearchParams()
  const studentIntent = search.get('intent') === 'student' || search.get('student') === '1'
  const studentToken = search.get('token')
  const generation = useRef(0)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [restoreError, setRestoreError] = useState(false)
  const [account, setAccount] = useState<WebAccountView | null>(null)
  const [entitlement, setEntitlement] = useState<WebEntitlementView | null>(null)
  const [billingConfig, setBillingConfig] = useState<BillingConfigView | null>(null)
  const [billingMessage, setBillingMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<'logout' | 'checkout' | 'portal' | 'restore' | null>(null)
  const [activating, setActivating] = useState(search.get('checkout') === 'complete')

  const refreshAccount = useCallback(async (gen = generation.current) => {
    const result = await loadWebAccount()
    if (gen !== generation.current) return result
    if (result.ok) {
      setAccount(result.account)
      setEntitlement(result.entitlement)
      setRestoreError(false)
      syncStoredSessionToExtension(result.account)
      if (result.entitlement?.isPro) setActivating(false)
      return result
    }
    if (
      result.error === 'auth' ||
      result.error === 'credentials' ||
      result.error === 'expired' ||
      result.error === null
    ) {
      setAccount(null)
      setEntitlement(null)
    } else if (hasStoredWebSession()) {
      setRestoreError(true)
    }
    return result
  }, [])

  useEffect(() => {
    let cancelled = false
    const gen = generation.current
    void (async () => {
      const [result, config] = await Promise.all([loadWebAccount(), fetchBillingConfig()])
      if (cancelled || gen !== generation.current) return
      if (config) setBillingConfig(config)
      if (result.ok) {
        setAccount(result.account)
        setEntitlement(result.entitlement)
        syncStoredSessionToExtension(result.account)
      } else if (
        result.error === 'auth' ||
        result.error === 'credentials' ||
        result.error === 'expired' ||
        result.error === null
      ) {
        setAccount(null)
        setEntitlement(null)
      } else if (hasStoredWebSession()) {
        setRestoreError(true)
      }
      setSessionChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!account) return
    void bootstrapWebLearningSync(account.id)
    void probeExtensionBridge().then((ready) => {
      if (ready) syncStoredSessionToExtension(account)
    })
  }, [account?.id])

  async function onLogout() {
    generation.current += 1
    setBusy('logout')
    setAccount(null)
    setEntitlement(null)
    await logoutWebAccount()
    setBusy(null)
  }

  async function onUpgrade() {
    setBusy('checkout')
    setBillingMessage(null)
    const result = await beginProCheckout('month')
    setBusy(null)
    if (!result.ok) {
      if (result.reason === 'auth') setBillingMessage(copy.billingAuthRequired)
      else if (result.reason === 'already_pro') setBillingMessage(copy.billingAlreadyPro)
      else if (result.reason === 'email_not_verified') setBillingMessage(copy.billingVerifyEmailRequired)
      else if (result.reason === 'checkout_failed') setBillingMessage(copy.billingCheckoutFailed)
      else setBillingMessage(copy.billingPrepared)
    }
  }

  async function onManageBilling() {
    setBusy('portal')
    setBillingMessage(null)
    const result = await openBillingPortal()
    setBusy(null)
    if (!result.ok) {
      if (result.reason === 'auth') setBillingMessage(copy.billingAuthRequired)
      else setBillingMessage(copy.billingPortalUnavailable)
    }
  }

  if (sessionChecking && hasStoredWebSession()) {
    return (
      <section className="section ac-section ac-section-dashboard">
        <div className="container ac-dash-wide" aria-busy="true">
          <p>{copy.loading}</p>
        </div>
      </section>
    )
  }

  if (restoreError && !account) {
    return (
      <section className="section ac-section ac-section-dashboard">
        <div className="container ac-dash-wide">
          <p role="alert">{copy.restoreError}</p>
          <Button type="button" onClick={() => void refreshAccount()} disabled={busy === 'restore'}>
            {copy.retry}
          </Button>
        </div>
      </section>
    )
  }

  if (!account) {
    return <Navigate to="/account" replace />
  }

  const billing = buildWorkspaceBillingProps({
    account,
    entitlement,
    billingConfig,
    sessionChecking,
    planLabels: {
      planPro: copy.planPro,
      planStudentPro: copy.planStudentPro,
      planTrial: copy.planTrial,
      planFree: copy.planFree,
      creditsResetSoon: copy.creditsResetSoon,
    },
  })

  return (
    <section className="section ac-section ac-section-dashboard">
      <div className="container ac-dash-wide">
        <DashboardApp
          account={account}
          entitlement={entitlement}
          planState={billing.planState}
          planLabel={billing.planLabel}
          isPro={billing.isPro}
          studentProActive={billing.studentProActive}
          inTrial={billing.inTrial}
          trialDays={billing.trialDays}
          checkoutReady={billing.checkoutReady}
          portalReady={billing.portalReady}
          activating={activating && !billing.isPro}
          billingBusy={busy === 'checkout' || busy === 'portal' ? busy : null}
          billingMessage={billingMessage}
          proPriceLabel={billing.proPriceLabel}
          creditsRemaining={billing.creditsRemaining}
          creditsUsed={billing.creditsUsed}
          dailyLimit={billing.dailyLimit}
          usagePercent={billing.usagePercent}
          resetIn={billing.resetIn}
          onLogout={() => void onLogout()}
          onUpgrade={() => void onUpgrade()}
          onManageBilling={() => void onManageBilling()}
          onRefreshAccount={() => void refreshAccount()}
        />
        {studentIntent ? (
          <StudentVerificationPanel autoFocus confirmToken={studentToken} onConfirmed={() => void refreshAccount()} />
        ) : null}
      </div>
    </section>
  )
}
