import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FLOWLARY_PRICING, FREE_DAILY_CREDITS, PRO_DAILY_CREDITS } from '@flowlary/shared'
import { Button, GetFlowlaryButton } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import {
  fetchBillingConfig,
  hasStoredWebSession,
  loadWebAccount,
  loginWebAccount,
  logoutWebAccount,
  registerWebAccount,
  type AccountClientError,
  type BillingConfigView,
  type WebAccountView,
  type WebEntitlementView,
} from '../account/client.ts'
import {
  beginProCheckout,
  catalogDisplayPrice,
  openBillingPortal,
  resolveCommercialPlanState,
} from '../account/billing.ts'
import { EmailVerificationPanel } from '../account/EmailVerificationPanel.tsx'
import { probeExtensionBridge, syncStoredSessionToExtension } from '../account/extensionBridge.ts'
import {
  clearPendingNext,
  parseSafeNext,
  readPendingNext,
  resolvePostAuthDestination,
  storePendingNext,
} from '../account/safeNext.ts'
import { bootstrapWebLearningSync } from '../lab/webLearningSync.ts'
import { DashboardApp } from '../dashboard/DashboardApp.tsx'
import { StudentVerificationPanel } from '../account/StudentVerificationPanel.tsx'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function errorCopy(code: AccountClientError, t: ReturnType<typeof useMessages>['account']): string {
  if (code === 'credentials' || code === 'auth') return t.errorAuth
  if (code === 'duplicate') return t.errorDuplicate
  if (code === 'invalid_email') return t.errorInvalidEmail
  if (code === 'invalid_password') return t.errorPasswordShort
  if (code === 'invalid') return t.errorInvalid
  if (code === 'expired') return t.errorExpired
  if (code === 'disabled') return t.errorDisabled
  if (code === 'network') return t.errorNetwork
  return t.errorUnavailable
}

function isRetryable(code: AccountClientError): boolean {
  return code === 'network' || code === 'unavailable'
}

function formatResetTime(resetAt: number | undefined, soonLabel: string): string | null {
  if (!resetAt) return null
  const ms = Math.max(0, resetAt - Date.now())
  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes <= 0) return soonLabel
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

function trialDaysRemaining(trialEndsAt: number | null | undefined): number | null {
  if (!trialEndsAt || trialEndsAt <= Date.now()) return null
  return Math.max(1, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.trim().length <= 254
}

export function AccountPage() {
  const t = useMessages()
  const copy = t.account
  const navigate = useNavigate()
  const [search, setSearch] = useSearchParams()
  const waitingForWebhook = search.get('checkout') === 'complete'
  const studentIntent = search.get('intent') === 'student' || search.get('student') === '1'
  const studentToken = search.get('token')
  const next = parseSafeNext(search.get('next'))
  const generation = useRef(0)
  const lastAuth = useRef<'login' | 'register' | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>(() =>
    search.get('mode') === 'register' || search.get('intent') === 'student' ? 'register' : 'login',
  )
  const [busy, setBusy] = useState<'login' | 'register' | 'logout' | 'checkout' | 'portal' | 'restore' | null>(null)
  const [sessionChecking, setSessionChecking] = useState(true)
  const [error, setError] = useState<AccountClientError | null>(null)
  const [restoreError, setRestoreError] = useState(false)
  const [justRegistered, setJustRegistered] = useState(false)
  const [justUpgraded, setJustUpgraded] = useState(waitingForWebhook)
  const [account, setAccount] = useState<WebAccountView | null>(null)
  const [entitlement, setEntitlement] = useState<WebEntitlementView | null>(null)
  const [activating, setActivating] = useState(waitingForWebhook)
  const [billingConfig, setBillingConfig] = useState<BillingConfigView | null>(null)
  const [billingMessage, setBillingMessage] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<'email' | 'password' | 'confirmPassword' | null>(null)

  async function applyAccount(
    nextAccount: WebAccountView,
    nextEntitlement: WebEntitlementView | null,
    gen: number,
  ) {
    if (gen !== generation.current) return
    setAccount(nextAccount)
    setEntitlement(nextEntitlement)
    setRestoreError(false)
    setError(null)
    syncStoredSessionToExtension(nextAccount)
    if (nextEntitlement?.isPro) {
      setActivating(false)
      if (waitingForWebhook) setJustUpgraded(true)
    }
  }

  async function refreshAccount(gen = generation.current) {
    const result = await loadWebAccount()
    if (gen !== generation.current) return result
    if (result.ok) {
      await applyAccount(result.account, result.entitlement, gen)
      return result
    }
    if (result.error === 'auth' || result.error === 'credentials' || result.error === 'expired' || result.error === null) {
      setAccount(null)
      setEntitlement(null)
      if (result.error === 'expired') setError('expired')
    } else if (hasStoredWebSession()) {
      setRestoreError(true)
    }
    return result
  }

  useEffect(() => {
    let cancelled = false
    const gen = generation.current
    void (async () => {
      const [result, config] = await Promise.all([loadWebAccount(), fetchBillingConfig()])
      if (cancelled || gen !== generation.current) return
      if (config) setBillingConfig(config)
      if (result.ok) {
        await applyAccount(result.account, result.entitlement, gen)
      } else if (
        result.error === 'auth' ||
        result.error === 'credentials' ||
        result.error === 'expired' ||
        result.error === null
      ) {
        setAccount(null)
        setEntitlement(null)
        if (result.error === 'expired') setError('expired')
      } else if (hasStoredWebSession()) {
        setRestoreError(true)
      }
      setBusy(null)
      setSessionChecking(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!account) return

    let cancelled = false
    const accountId = account.id

    void bootstrapWebLearningSync(accountId)

    void probeExtensionBridge().then((ready) => {
      if (cancelled) return
      if (ready) syncStoredSessionToExtension(account)
    })

    return () => {
      cancelled = true
    }
  }, [account?.id])

  useEffect(() => {
    if (!activating || !account) return
    let cancelled = false
    const started = Date.now()
    const timer = window.setInterval(() => {
      void (async () => {
        const gen = generation.current
        const nextState = await loadWebAccount()
        if (cancelled || gen !== generation.current) return
        if (nextState.ok) {
          await applyAccount(nextState.account, nextState.entitlement, gen)
          if (nextState.entitlement?.isPro) {
            syncStoredSessionToExtension(nextState.account, { force: true })
            window.clearInterval(timer)
          }
        }
        if (Date.now() - started > 60_000) window.clearInterval(timer)
      })()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activating, account])

  function afterAuthenticated(registered: boolean, currentAccount?: WebAccountView | null) {
    setPassword('')
    if (next) storePendingNext(next)
    if (registered) {
      setJustRegistered(true)
      if (search.get('mode')) {
        const nextParams = new URLSearchParams(search)
        nextParams.delete('mode')
        setSearch(nextParams, { replace: true })
      }
      return
    }
    const active = currentAccount ?? account
    const pending = next ?? readPendingNext()
    if (pending === 'lab' && active?.emailVerified !== false) {
      clearPendingNext()
      navigate('/#writing-lab', { replace: true })
      return
    }
    if (pending === 'checkout' && active?.emailVerified !== false) {
      void onUpgrade()
      return
    }
    if (search.get('mode') || search.get('next')) {
      const nextParams = new URLSearchParams(search)
      nextParams.delete('mode')
      nextParams.delete('next')
      setSearch(nextParams, { replace: true })
    }
  }

  async function onVerifiedEmail() {
    const loaded = await loadWebAccount()
    if (!loaded.ok) return
    setAccount(loaded.account)
    setEntitlement(loaded.entitlement)
    syncStoredSessionToExtension(loaded.account)
    if (loaded.account.emailVerified === false) return
    const pending = readPendingNext() ?? next
    if (pending === 'lab') {
      clearPendingNext()
      navigate('/#writing-lab', { replace: true })
      return
    }
    if (pending === 'checkout') {
      void onUpgrade()
      return
    }
    setJustRegistered(true)
  }

  async function onLogin() {
    lastAuth.current = 'login'
    if (!isValidEmail(email)) {
      setFieldError('email')
      setError('invalid_email')
      return
    }
    setBusy('login')
    setError(null)
    setFieldError(null)
    const gen = ++generation.current
    const result = await loginWebAccount(email.trim(), password)
    if (gen !== generation.current) return
    if (result.ok) {
      setAccount(result.account)
      await refreshAccount(gen)
      afterAuthenticated(false, result.account)
    } else {
      setError(result.error)
      if (result.error === 'invalid_email') setFieldError('email')
      if (result.error === 'invalid_password' || result.error === 'credentials') setFieldError('password')
    }
    setBusy(null)
  }

  async function onRegister() {
    lastAuth.current = 'register'
    if (!isValidEmail(email)) {
      setFieldError('email')
      setError('invalid_email')
      return
    }
    if (password.trim().length < 8) {
      setFieldError('password')
      setError('invalid_password')
      return
    }
    if (password !== confirmPassword) {
      setFieldError('confirmPassword')
      return
    }
    setBusy('register')
    setError(null)
    setFieldError(null)
    const gen = ++generation.current
    const result = await registerWebAccount(email.trim(), password)
    if (gen !== generation.current) return
    if (result.ok) {
      setAccount(result.account)
      await refreshAccount(gen)
      afterAuthenticated(true, result.account)
    } else {
      setError(result.error)
      if (result.error === 'invalid_email') setFieldError('email')
      if (result.error === 'invalid_password') setFieldError('password')
      if (result.error === 'duplicate') setAuthMode('login')
    }
    setBusy(null)
  }

  async function onLogout() {
    generation.current += 1
    setBusy('logout')
    setError(null)
    setAccount(null)
    setEntitlement(null)
    setActivating(false)
    setJustRegistered(false)
    setJustUpgraded(false)
    setRestoreError(false)
    await logoutWebAccount()
    setBusy(null)
    setAuthMode('login')
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

  async function onRetryAuth() {
    if (lastAuth.current === 'register') await onRegister()
    else if (lastAuth.current === 'login') await onLogin()
    else setError(null)
  }

  async function onRetryRestore() {
    setBusy('restore')
    setRestoreError(false)
    await refreshAccount()
    setBusy(null)
    setSessionChecking(false)
  }

  const restoring = sessionChecking && hasStoredWebSession()
  const isPro = entitlement?.isPro === true
  const studentProActive = entitlement?.studentProActive === true
  const inTrial = entitlement?.inTrial === true || account?.inTrial === true
  const subscription = entitlement?.subscription ?? account?.subscription
  const planState = resolveCommercialPlanState({
    loading: sessionChecking,
    account,
    entitlement,
  })
  const checkoutReady = billingConfig?.checkoutAvailable === true
  const portalReady = billingConfig?.portalAvailable === true
  const trialEndsAt = entitlement?.trialEndsAt ?? account?.trialEndsAt ?? null
  const trialDays = trialDaysRemaining(trialEndsAt)
  const planLabel = isPro
    ? copy.planPro
    : studentProActive
      ? copy.planStudentPro
      : inTrial
        ? copy.planTrial
        : copy.planFree
  const creditsKnown = Boolean(account) && !sessionChecking
  const creditsRemaining = creditsKnown
    ? (entitlement?.creditsRemaining ?? account?.creditsRemaining ?? entitlement?.remainingMs ?? account?.remainingMs ?? 0)
    : null
  const dailyLimit = entitlement?.dailyLimit ?? account?.dailyLimit ?? FREE_DAILY_CREDITS
  const creditsUsed = entitlement?.creditsUsed ?? account?.creditsUsed
  const proPriceLabel =
    billingConfig?.proPriceMonthly || billingConfig?.proPrice
      ? `${catalogDisplayPrice(
          billingConfig.proPriceMonthly ?? billingConfig.proPrice ?? null,
          FLOWLARY_PRICING.monthly.amountCents,
        )}/mo`
      : null
  const resetIn = formatResetTime(entitlement?.resetAt ?? account?.resetAt, copy.creditsResetSoon)
  const usagePercent =
    creditsKnown && dailyLimit > 0
      ? Math.min(
          100,
          Math.round(
            ((creditsUsed ?? Math.max(0, dailyLimit - (creditsRemaining ?? 0))) / dailyLimit) * 100,
          ),
        )
      : 0
  const showWelcome = Boolean(account) && justRegistered && account?.emailVerified !== false
  const needsVerification = Boolean(account) && account?.emailVerified === false
  const showVerificationGate = needsVerification && justRegistered
  const inputsDisabled = busy === 'login' || busy === 'register' || restoring
  const submitDisabled =
    inputsDisabled ||
    (authMode === 'register' &&
      (password.length < 8 || confirmPassword.length < 8 || password !== confirmPassword))

  return (
    <div className={`ac-page${account ? ' ac-page-dashboard' : ' ac-page-signed-out'}`}>
      {restoring ? (
        <section className="section ac-section">
          <div className="container ac-auth-shell" aria-busy="true">
            <p className="ac-kicker">{copy.dashboardKicker}</p>
            <h1>{copy.loading}</h1>
            <div className="ac-auth-card">
              <div className="ac-skeleton ac-skeleton-line" />
              <div className="ac-skeleton ac-skeleton-line" />
              <div className="ac-skeleton ac-skeleton-line" />
            </div>
          </div>
        </section>
      ) : restoreError && hasStoredWebSession() && !account ? (
        <section className="section ac-section">
          <div className="container ac-auth-shell">
            <h1>{copy.dashboardKicker}</h1>
            <div className="ac-auth-card">
              <div className="ac-alert" role="alert">
                <p>{copy.restoreError}</p>
                <div className="ac-actions">
                  <Button type="button" onClick={() => void onRetryRestore()} disabled={busy === 'restore'}>
                    {copy.retry}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void onLogout()}>
                    {copy.signOut}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : showVerificationGate && account ? (
        <section className="section ac-section">
          <div className="container ac-auth-shell">
            <EmailVerificationPanel
              email={account.email}
              onVerified={() => void onVerifiedEmail()}
              onSignOut={() => void onLogout()}
            />
          </div>
        </section>
      ) : showWelcome && account ? (
        <section className="section ac-section">
          <div className="container ac-auth-shell">
            <p className="ac-kicker">{copy.kicker}</p>
            <h1>{copy.welcomeNextTitle}</h1>
            <p className="ac-lead">{copy.welcomeNextLead}</p>
            <article className="ac-auth-card ac-welcome-card">
              <p>{copy.welcomeNextBody}</p>
              {inTrial ? (
                <ul className="ac-welcome-facts">
                  <li>{copy.welcomeTrialDuration}</li>
                  <li>{fill(copy.welcomeTrialCredits, { count: entitlement?.dailyLimit ?? PRO_DAILY_CREDITS })}</li>
                  {trialDays ? <li>{fill(copy.trialRemaining, { count: trialDays })}</li> : null}
                </ul>
              ) : (
                <p className="ac-hint">{copy.trustLine}</p>
              )}
              <div className="ac-welcome-actions">
                <Button to="/#writing-lab">{copy.startWriting}</Button>
                <GetFlowlaryButton variant="secondary" />
              </div>
            </article>
          </div>
        </section>
      ) : account ? (
        <section className="section ac-section ac-section-dashboard">
          <div className="container ac-dash-wide">
            <DashboardApp
              account={account}
              entitlement={entitlement}
              planState={planState}
              planLabel={planLabel}
              isPro={isPro}
              studentProActive={studentProActive}
              inTrial={inTrial}
              trialDays={trialDays}
              checkoutReady={checkoutReady}
              portalReady={portalReady}
              activating={activating && !isPro}
              billingBusy={busy === 'checkout' || busy === 'portal' ? busy : null}
              billingMessage={billingMessage}
              proPriceLabel={proPriceLabel}
              creditsRemaining={creditsRemaining}
              creditsUsed={creditsUsed}
              dailyLimit={dailyLimit}
              usagePercent={usagePercent}
              resetIn={resetIn}
              onLogout={() => void onLogout()}
              onUpgrade={() => void onUpgrade()}
              onManageBilling={() => void onManageBilling()}
              onRefreshAccount={() => void refreshAccount()}
            />
            {studentIntent ? (
              <StudentVerificationPanel
                autoFocus
                confirmToken={studentToken}
                onConfirmed={() => void refreshAccount()}
              />
            ) : null}
          </div>
        </section>
      ) : (
        <section className="section ac-section">
          <div className="container ac-auth-shell">
            <p className="ac-kicker">{copy.kicker}</p>
            <h1>{authMode === 'register' ? copy.createTitle : copy.formTitle}</h1>
            <p className="ac-lead">{authMode === 'register' ? copy.createLead : copy.formLead}</p>
            {studentIntent && authMode === 'register' ? (
              <p className="ac-student-register-note">{copy.student.verificationOpensNote}</p>
            ) : null}

            <article className="ac-auth-card">
              <form
                className="ac-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault()
                  if (authMode === 'register') void onRegister()
                  else void onLogin()
                }}
              >
                <label className="ac-field" htmlFor="ac-email">
                  <span>{copy.email}</span>
                  <input
                    id="ac-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (fieldError === 'email') setFieldError(null)
                    }}
                    required
                    aria-invalid={fieldError === 'email' || undefined}
                    aria-describedby={error ? 'ac-auth-error' : undefined}
                    disabled={inputsDisabled}
                  />
                </label>
                <label className="ac-field" htmlFor="ac-password">
                  <span>{copy.password}</span>
                  <div className="ac-input-wrap">
                    <input
                      id="ac-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        if (fieldError === 'password') setFieldError(null)
                      }}
                      minLength={8}
                      required
                      aria-invalid={fieldError === 'password' || undefined}
                      aria-describedby={authMode === 'register' ? 'ac-password-hint' : error ? 'ac-auth-error' : undefined}
                      disabled={inputsDisabled}
                    />
                    <button
                      type="button"
                      className="ac-toggle-pw ac-toggle-pw-inline"
                      aria-pressed={showPassword}
                      aria-controls="ac-password"
                      aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? copy.hidePassword : copy.showPassword}
                    </button>
                  </div>
                </label>
                {authMode === 'register' ? (
                  <>
                    <p id="ac-password-hint" className="ac-hint">
                      {copy.passwordHint}
                    </p>
                    <label className="ac-field" htmlFor="ac-confirm-password">
                      <span>{copy.confirmPassword}</span>
                      <div className="ac-input-wrap">
                        <input
                          id="ac-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          name="confirm-password"
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(event) => {
                            setConfirmPassword(event.target.value)
                            if (fieldError === 'confirmPassword') setFieldError(null)
                          }}
                          minLength={8}
                          required
                          aria-invalid={fieldError === 'confirmPassword' || undefined}
                          disabled={inputsDisabled}
                        />
                        <button
                          type="button"
                          className="ac-toggle-pw ac-toggle-pw-inline"
                          aria-pressed={showConfirmPassword}
                          aria-controls="ac-confirm-password"
                          aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword}
                          onClick={() => setShowConfirmPassword((value) => !value)}
                        >
                          {showConfirmPassword ? copy.hidePassword : copy.showPassword}
                        </button>
                      </div>
                    </label>
                  </>
                ) : null}

                {fieldError === 'confirmPassword' ? (
                  <div className="ac-alert" role="alert">
                    <p>{copy.passwordMismatch}</p>
                  </div>
                ) : null}

                {error ? (
                  <div className="ac-alert" id="ac-auth-error" role="alert">
                    <p>{errorCopy(error, copy)}</p>
                    {isRetryable(error) ? (
                      <div className="ac-actions">
                        <Button type="button" variant="secondary" onClick={() => void onRetryAuth()}>
                          {copy.retry}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <Button
                  type="submit"
                  className="ac-submit"
                  disabled={submitDisabled}
                  aria-busy={busy === authMode}
                >
                  {busy === 'register'
                    ? copy.submittingRegister
                    : busy === 'login'
                      ? copy.submittingLogin
                      : authMode === 'register'
                        ? copy.createAccount
                        : copy.signIn}
                </Button>
                {authMode === 'login' ? (
                  <p className="ac-forgot">
                    <Link className="ac-link" to="/account/forgot-password">
                      {copy.forgotPassword}
                    </Link>
                  </p>
                ) : null}
              </form>
            </article>

            <p className="ac-switch">
              {authMode === 'register' ? (
                <button
                  type="button"
                  className="ac-text-btn"
                  disabled={inputsDisabled}
                  onClick={() => {
                    setError(null)
                    setFieldError(null)
                    setAuthMode('login')
                  }}
                >
                  {copy.haveAccount}
                </button>
              ) : (
                <>
                  {copy.noAccount}{' '}
                  <button
                    type="button"
                    className="ac-text-btn"
                    disabled={inputsDisabled}
                    onClick={() => {
                      setError(null)
                      setFieldError(null)
                      setAuthMode('register')
                    }}
                  >
                    {copy.createAccount}
                  </button>
                </>
              )}
            </p>

            <p className="ac-trust">{copy.trustLine}</p>
            <p className="ac-extension-link">
              <Button variant="ghost" to="/support#get-flowlary">
                {copy.installExtensionCta}
              </Button>
              <Button variant="ghost" to="/pricing">
                {copy.viewPlans}
              </Button>
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
