import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PRO_DAILY_CREDITS } from '@flowlary/shared'
import { Button, InstallFlowlaryButton } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import {
  loadWebAccount,
  resendWebVerification,
  verifyEmailToken,
  type VerificationClientError,
  type WebAccountView,
} from '../account/client.ts'
import {
  clearPendingNext,
  parseSafeNext,
  readPendingNext,
  resolvePostAuthDestination,
  storePendingNext,
} from '../account/safeNext.ts'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function trialDaysRemaining(trialEndsAt: number | null | undefined): number | null {
  if (!trialEndsAt || trialEndsAt <= Date.now()) return null
  return Math.max(1, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

type VerifyState =
  | { phase: 'loading' }
  | { phase: 'success'; account: WebAccountView }
  | { phase: 'already_verified' }
  | { phase: 'expired' }
  | { phase: 'invalid' }
  | { phase: 'network' }
  | { phase: 'missing_token' }

export function VerifyEmailPage() {
  const t = useMessages()
  const copy = t.account.verifyPage
  const panel = t.account.verification
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const token = search.get('token')?.trim() ?? ''
  const urlNext = parseSafeNext(search.get('next'))
  const [state, setState] = useState<VerifyState>({ phase: 'loading' })
  const [resendBusy, setResendBusy] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (urlNext) storePendingNext(urlNext)
  }, [urlNext])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  useEffect(() => {
    if (!token) {
      setState({ phase: 'missing_token' })
      return
    }
    let cancelled = false
    void (async () => {
      const result = await verifyEmailToken(token)
      if (cancelled) return
      if (result.ok) {
        if (result.status === 'verified') {
          setState({ phase: 'success', account: result.account })
          return
        }
        setState({ phase: 'already_verified' })
        return
      }
      if (result.error === 'expired_token') setState({ phase: 'expired' })
      else if (result.error === 'invalid_token') setState({ phase: 'invalid' })
      else setState({ phase: 'network' })
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const pendingNext = urlNext ?? readPendingNext()

  function onStartWriting() {
    clearPendingNext()
    navigate(resolvePostAuthDestination(pendingNext), { replace: true })
  }

  async function onResend() {
    if (resendCooldown > 0 || resendBusy) return
    setResendBusy(true)
    setResendError(null)
    setResendStatus(null)
    const session = await loadWebAccount()
    if (!session.ok) {
      setResendBusy(false)
      setResendError(copy.signInToResend)
      return
    }
    const result = await resendWebVerification()
    setResendBusy(false)
    if (result.ok) {
      setResendStatus(result.sent ? panel.resent : panel.resendUnavailable)
      setResendCooldown(60)
      return
    }
    if (result.error === 'rate_limited') {
      setResendError(panel.resendRateLimited)
      setResendCooldown(60)
      return
    }
    setResendError(mapResendError(result.error))
  }

  function mapResendError(err: VerificationClientError): string {
    if (err === 'network') return panel.networkError
    return panel.resendFailed
  }

  if (state.phase === 'loading') {
    return (
      <div className="ac-page ac-page-signed-out">
        <section className="section ac-section">
          <div className="container ac-auth-shell" aria-busy="true">
            <p className="ac-kicker">{copy.kicker}</p>
            <h1>{copy.verifyingTitle}</h1>
            <article className="ac-auth-card">
              <div className="ac-skeleton ac-skeleton-line" />
              <div className="ac-skeleton ac-skeleton-line" />
            </article>
          </div>
        </section>
      </div>
    )
  }

  if (state.phase === 'success') {
    const trialDays = trialDaysRemaining(state.account.trialEndsAt)
    return (
      <div className="ac-page ac-page-signed-out">
        <section className="section ac-section">
          <div className="container ac-auth-shell">
            <p className="ac-kicker">{copy.kicker}</p>
            <h1>{copy.welcomeTitle}</h1>
            <p className="ac-lead">{copy.welcomeLead}</p>
            <article className="ac-auth-card ac-welcome-card">
              <p className="ac-alert is-ok" role="status">
                {copy.successMessage}
              </p>
              {state.account.inTrial && trialDays ? (
                <p className="ac-hint">{fill(copy.trialActive, { count: trialDays })}</p>
              ) : (
                <p className="ac-hint">{copy.accountReady}</p>
              )}
              <p className="ac-hint">
                {fill(copy.creditsNote, { count: state.account.dailyLimit ?? PRO_DAILY_CREDITS })}
              </p>
              <div className="ac-welcome-actions">
                <Button type="button" onClick={onStartWriting}>
                  {copy.startWriting}
                </Button>
                <InstallFlowlaryButton variant="secondary" />
              </div>
            </article>
          </div>
        </section>
      </div>
    )
  }

  const errorTitle =
    state.phase === 'expired'
      ? copy.expiredTitle
      : state.phase === 'invalid' || state.phase === 'missing_token'
        ? copy.invalidTitle
        : state.phase === 'already_verified'
          ? copy.alreadyVerifiedTitle
          : copy.errorTitle

  const errorLead =
    state.phase === 'expired'
      ? copy.expiredLead
      : state.phase === 'invalid' || state.phase === 'missing_token'
        ? copy.invalidLead
        : state.phase === 'already_verified'
          ? copy.alreadyVerifiedLead
          : copy.errorLead

  return (
    <div className="ac-page ac-page-signed-out">
      <section className="section ac-section">
        <div className="container ac-auth-shell">
          <p className="ac-kicker">{copy.kicker}</p>
          <h1>{errorTitle}</h1>
          <p className="ac-lead">{errorLead}</p>
          <article className="ac-auth-card">
            {state.phase === 'already_verified' ? (
              <div className="ac-actions">
                <Button type="button" onClick={onStartWriting}>
                  {copy.startWriting}
                </Button>
                <Button variant="ghost" to="/account">
                  {copy.goToAccount}
                </Button>
              </div>
            ) : (
              <>
                <p className="ac-hint">{copy.resendHint}</p>
                <div className="ac-actions">
                  <Button
                    type="button"
                    disabled={resendBusy || resendCooldown > 0}
                    onClick={() => void onResend()}
                  >
                    {resendCooldown > 0
                      ? panel.resendCooldown.replace('{seconds}', String(resendCooldown))
                      : resendBusy
                        ? panel.resending
                        : panel.resend}
                  </Button>
                  <Button variant="ghost" to="/account">
                    {copy.signIn}
                  </Button>
                </div>
                {resendStatus ? (
                  <p className="ac-alert is-ok" role="status">
                    {resendStatus}
                  </p>
                ) : null}
                {resendError ? (
                  <p className="ac-alert" role="alert">
                    {resendError}
                  </p>
                ) : null}
                <p className="ac-hint">
                  <Link to="/account">{copy.signIn}</Link>
                </p>
              </>
            )}
          </article>
        </div>
      </section>
    </div>
  )
}
