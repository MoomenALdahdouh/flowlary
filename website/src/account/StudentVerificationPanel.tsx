import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { STUDENT_PROGRAM_DURATION_MONTHS } from '@flowlary/shared'
import { Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import {
  confirmStudentVerification,
  fetchStudentStatus,
  requestStudentVerification,
  submitStudentEnrollmentReview,
  type StudentStatusView,
} from './client.ts'
import { emitPricingEvent } from '../lib/pricingEvents.ts'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

type StudentVerificationPanelProps = {
  autoFocus?: boolean
  confirmToken?: string | null
  onConfirmed?: () => void
}

export function StudentVerificationPanel({
  autoFocus = false,
  confirmToken = null,
  onConfirmed,
}: StudentVerificationPanelProps) {
  const t = useMessages()
  const copy = t.account.student
  const [status, setStatus] = useState<StudentStatusView | null>(null)
  const [academicEmail, setAcademicEmail] = useState('')
  const [institutionHint, setInstitutionHint] = useState('')
  const [busy, setBusy] = useState<'load' | 'request' | 'confirm' | 'review' | null>('load')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refreshStatus() {
    setBusy('load')
    const result = await fetchStudentStatus()
    setBusy(null)
    if (result.ok) {
      setStatus(result.student)
    } else {
      setError(copy.errorUnavailable)
    }
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  useEffect(() => {
    if (!confirmToken) return
    let cancelled = false
    void (async () => {
      setBusy('confirm')
      setError(null)
      const result = await confirmStudentVerification(confirmToken)
      if (cancelled) return
      setBusy(null)
      if (result.ok && result.status === 'verified') {
        emitPricingEvent('student_verification_completed')
        setMessage(copy.verifiedMessage)
        onConfirmed?.()
        await refreshStatus()
      } else if (result.ok && result.status === 'already_verified') {
        setMessage(copy.alreadyVerified)
        await refreshStatus()
      } else if (result.ok && result.status === 'expired_token') {
        setError(copy.expiredToken)
      } else {
        setError(copy.invalidToken)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [confirmToken])

  async function onRequestEmail(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setBusy('request')
    emitPricingEvent('student_verification_started')
    const result = await requestStudentVerification(academicEmail.trim())
    setBusy(null)
    if (result.ok) {
      setMessage(fill(copy.sentMessage, { email: result.maskedEmail }))
      await refreshStatus()
    } else if (result.error === 'invalid') {
      setError(copy.invalidEmail)
    } else if (result.error === 'duplicate') {
      setError(copy.duplicateEmail)
    } else if (result.error === 'rate_limited') {
      setError(copy.rateLimited)
    } else {
      setError(copy.errorUnavailable)
    }
  }

  async function onSubmitReview(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setBusy('review')
    const result = await submitStudentEnrollmentReview(institutionHint.trim())
    setBusy(null)
    if (result.ok) {
      setMessage(copy.reviewSubmitted)
      await refreshStatus()
    } else {
      setError(copy.errorUnavailable)
    }
  }

  const active = status?.status === 'active' && status.verified
  const pending = status?.status === 'pending'
  const expired = status?.status === 'expired'
  const revoked = status?.status === 'revoked'

  return (
    <section className="ac-student-panel" aria-labelledby="ac-student-title" data-autofocus={autoFocus || undefined}>
      <p className="ac-kicker">{copy.kicker}</p>
      <h2 id="ac-student-title">{copy.title}</h2>
      <p className="ac-lead">{fill(copy.lead, { months: STUDENT_PROGRAM_DURATION_MONTHS })}</p>

      {active ? (
        <div className="ac-student-active">
          <p>{copy.activeMessage}</p>
          {status?.expiresAt ? (
            <p className="ac-hint">{fill(copy.expiresLabel, { date: new Date(status.expiresAt).toLocaleDateString() })}</p>
          ) : null}
        </div>
      ) : expired ? (
        <div className="ac-student-expired" role="status">
          <p>{copy.expiredBenefit}</p>
        </div>
      ) : revoked ? (
        <div className="ac-student-revoked" role="status">
          <p>{copy.revokedBenefit}</p>
        </div>
      ) : (
        <>
          <ol className="ac-student-steps">
            {copy.steps.map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
          <p className="ac-hint">{copy.verificationOpensNote}</p>

          {pending && status?.pendingEmail ? (
            <p className="ac-student-pending">{fill(copy.pendingEmail, { email: status.pendingEmail })}</p>
          ) : null}

          <form className="ac-student-form" onSubmit={(event) => void onRequestEmail(event)}>
            <label htmlFor="ac-student-email">{copy.academicEmailLabel}</label>
            <input
              id="ac-student-email"
              type="email"
              autoComplete="email"
              value={academicEmail}
              onChange={(event) => setAcademicEmail(event.target.value)}
              placeholder={copy.academicEmailPlaceholder}
              disabled={busy !== null}
            />
            <Button type="submit" disabled={busy !== null || !academicEmail.trim()}>
              {busy === 'request' ? copy.sending : copy.sendVerification}
            </Button>
          </form>

          <details className="ac-student-review">
            <summary>{copy.reviewTitle}</summary>
            <p>{copy.reviewBody}</p>
            <form onSubmit={(event) => void onSubmitReview(event)}>
              <label htmlFor="ac-student-institution">{copy.institutionLabel}</label>
              <input
                id="ac-student-institution"
                type="text"
                value={institutionHint}
                onChange={(event) => setInstitutionHint(event.target.value)}
                disabled={busy !== null}
              />
              <Button type="submit" variant="secondary" disabled={busy !== null || institutionHint.trim().length < 2}>
                {busy === 'review' ? copy.submittingReview : copy.submitReview}
              </Button>
            </form>
          </details>
        </>
      )}

      {message ? <p className="ac-student-success">{message}</p> : null}
      {error ? (
        <p className="ac-student-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
