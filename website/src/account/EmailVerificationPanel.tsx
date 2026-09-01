import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import {
  resendWebVerification,
  type AccountClientError,
  type VerificationClientError,
} from '../account/client.ts'

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  return `${local.slice(0, 1)}***@${domain}`
}

type Props = {
  email: string
  onVerified: () => void
  onSignOut: () => void
  compact?: boolean
}

export function EmailVerificationPanel({ email, onVerified, onSignOut, compact = false }: Props) {
  const t = useMessages()
  const copy = t.account.verification
  const [busy, setBusy] = useState<'resend' | 'refresh' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const mapResendError = useCallback(
    (err: VerificationClientError): string => {
      if (err === 'rate_limited') return copy.resendRateLimited
      if (err === 'network') return copy.networkError
      return copy.resendFailed
    },
    [copy],
  )

  async function onResend() {
    if (resendCooldown > 0) return
    setBusy('resend')
    setError(null)
    setStatus(null)
    const result = await resendWebVerification()
    setBusy(null)
    if (result.ok) {
      setStatus(result.sent ? copy.resent : copy.resendUnavailable)
      setResendCooldown(60)
      return
    }
    if (result.error === 'rate_limited') {
      setError(copy.resendRateLimited)
      setResendCooldown(60)
      return
    }
    setError(mapResendError(result.error))
  }

  const shellClass = compact ? 'ac-verify ac-verify-compact' : 'ac-auth-card ac-verify'

  return (
    <article className={shellClass} aria-labelledby="ac-verify-title">
      <p className="ac-kicker">{copy.kicker}</p>
      <h2 id="ac-verify-title">{copy.title}</h2>
      <p className="ac-lead">{copy.lead}</p>
      <p className="ac-hint">{copy.sentTo.replace('{email}', maskEmail(email))}</p>
      <p className="ac-hint">{copy.checkInbox}</p>

      <div className="ac-actions">
        <Button type="button" disabled={busy !== null} onClick={() => void onVerified()}>
          {busy === 'refresh' ? copy.checking : copy.continueAfterVerify}
        </Button>
        <Button type="button" variant="ghost" disabled={busy !== null || resendCooldown > 0} onClick={() => void onResend()}>
          {resendCooldown > 0
            ? copy.resendCooldown.replace('{seconds}', String(resendCooldown))
            : busy === 'resend'
              ? copy.resending
              : copy.resend}
        </Button>
        {!compact ? (
          <Button type="button" variant="ghost" onClick={onSignOut}>
            {copy.signOut}
          </Button>
        ) : null}
      </div>

      {status ? (
        <p id="ac-verify-status" className="ac-alert is-ok" role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
      {error ? (
        <p id="ac-verify-error" className="ac-alert" role="alert">
          {error}
        </p>
      ) : null}

      {!compact ? (
        <p className="ac-hint">{copy.afterVerifyHint}</p>
      ) : null}
    </article>
  )
}
