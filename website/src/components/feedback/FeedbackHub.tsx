import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { FeatureRequestPublicView, FeedbackConfigView } from '@flowlary/shared'
import { SATISFACTION_IMPROVE_CATEGORIES, SUPPORT_ISSUE_TYPES } from '@flowlary/shared'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { hasStoredWebSession } from '../../account/client.ts'
import { Button } from '../Ui.tsx'
import { StarRating } from './StarRating.tsx'
import {
  createFeatureRequest,
  createSupportTicket,
  fetchFeatureRequests,
  fetchFeedbackConfigPublic,
  submitFeedback,
  submitRating,
  voteFeatureRequest,
} from '../../feedback/client.ts'
import { emitFeedbackEvent } from '../../lib/feedbackEvents.ts'

type Tab = 'feedback' | 'features' | 'support'

const FEATURE_SUGGESTIONS = [
  'Desktop app',
  'Better correction explanations',
  'Mobile support',
  'Vocabulary learning',
  'Better Gmail support',
  'More language support',
] as const

export function FeedbackHub({ initialTab = 'feedback' }: { initialTab?: Tab }) {
  const t = useMessages()
  const f = t.feedback
  const { locale } = useI18n()
  const [searchParams] = useSearchParams()
  const signedIn = hasStoredWebSession()
  const [tab, setTab] = useState<Tab>(initialTab)
  const [config, setConfig] = useState<FeedbackConfigView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [rating, setRating] = useState<number | null>(null)
  const [ratingCategory, setRatingCategory] = useState<string | null>(null)
  const [ratingMessage, setRatingMessage] = useState('')

  const [feedbackType, setFeedbackType] = useState('GENERAL_FEEDBACK')
  const [feedbackMessage, setFeedbackMessage] = useState('')

  const [featureTitle, setFeatureTitle] = useState('')
  const [featureDescription, setFeatureDescription] = useState('')
  const [features, setFeatures] = useState<FeatureRequestPublicView[]>([])

  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketIssueType, setTicketIssueType] = useState('GENERAL')
  const [createdTicketNumber, setCreatedTicketNumber] = useState<string | null>(null)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)

  const [testimonialConsent, setTestimonialConsent] = useState<'yes' | 'no' | null>(null)
  const [testimonialDisplayPreference, setTestimonialDisplayPreference] = useState<
    'full_name' | 'first_initial' | 'anonymous'
  >('first_initial')
  const [testimonialDisplayName, setTestimonialDisplayName] = useState('')
  const [testimonialRole, setTestimonialRole] = useState('')

  useEffect(() => {
    void fetchFeedbackConfigPublic().then((res) => {
      if (res.ok) setConfig(res.body.config)
    })
  }, [])

  useEffect(() => {
    const issue = searchParams.get('issueType')
    if (issue) setTicketIssueType(issue)
    if (searchParams.get('extVersion')) setIncludeDiagnostics(true)
  }, [searchParams])

  useEffect(() => {
    if (!signedIn || tab !== 'features') return
    void fetchFeatureRequests().then((res) => {
      if (res.ok) setFeatures(res.body.items)
    })
  }, [signedIn, tab])

  const improveCategories = useMemo(
    () =>
      SATISFACTION_IMPROVE_CATEGORIES.map((id) => ({
        id,
        label: f.categories[id as keyof typeof f.categories] ?? id,
      })),
    [f.categories],
  )

  async function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, eventName?: Parameters<typeof emitFeedbackEvent>[0]) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    const result = await fn()
    setLoading(false)
    if (!result.ok) {
      setError(f.errors.generic)
      return
    }
    if (eventName) emitFeedbackEvent(eventName)
    setSuccess(f.success)
  }

  async function handleRatingSubmit() {
    if (!rating) return
    await runAction(async () => {
      const res = await submitRating({
        rating,
        category: ratingCategory,
        message: ratingMessage || undefined,
        source: 'website',
        surface: 'account',
        locale,
        promptId: 'general_satisfaction',
        ...(testimonialConsent === 'yes'
          ? {
              testimonialConsent: 'yes',
              testimonialDisplayPreference,
              testimonialDisplayName: testimonialDisplayName || undefined,
              testimonialRole: testimonialRole || undefined,
            }
          : testimonialConsent === 'no'
            ? { testimonialConsent: 'no' }
            : {}),
      })
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    }, 'rating_submitted')
  }

  async function handleFeedbackSubmit() {
    if (!feedbackMessage.trim()) return
    await runAction(async () => {
      const res = await submitFeedback({
        type: feedbackType,
        message: feedbackMessage,
        source: 'website',
        surface: 'account',
        locale,
        ...(testimonialConsent === 'yes'
          ? {
              testimonialConsent: 'yes',
              testimonialDisplayPreference,
              testimonialDisplayName: testimonialDisplayName || undefined,
              testimonialRole: testimonialRole || undefined,
            }
          : testimonialConsent === 'no'
            ? { testimonialConsent: 'no' }
            : {}),
      })
      if (res.ok) setFeedbackMessage('')
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    }, 'feedback_submitted')
  }

  async function handleFeatureSubmit() {
    if (!featureTitle.trim() || !featureDescription.trim()) return
    await runAction(async () => {
      const res = await createFeatureRequest({
        title: featureTitle,
        description: featureDescription,
        source: 'website',
        surface: 'account',
        locale,
      })
      if (res.ok) {
        setFeatureTitle('')
        setFeatureDescription('')
        setFeatures((prev) => [res.body.item, ...prev.filter((item) => item.id !== res.body.item.id)])
      }
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    }, 'feature_request_created')
  }

  async function handleVote(id: string) {
    setLoading(true)
    const res = await voteFeatureRequest(id)
    setLoading(false)
    if (res.ok) {
      setFeatures((prev) => prev.map((item) => (item.id === id ? res.body.item : item)))
      emitFeedbackEvent('feature_request_voted')
    } else {
      setError(f.errors.generic)
    }
  }

  function TestimonialConsentFields() {
    return (
      <fieldset className="fb-testimonial-consent">
        <legend>{f.testimonial.question}</legend>
        <p className="muted">{f.testimonial.note}</p>
        <div className="fb-chip-row" role="radiogroup" aria-label={f.testimonial.question}>
          <button
            type="button"
            className={`fb-chip${testimonialConsent === 'yes' ? ' is-active' : ''}`}
            onClick={() => setTestimonialConsent('yes')}
          >
            {f.testimonial.yes}
          </button>
          <button
            type="button"
            className={`fb-chip${testimonialConsent === 'no' ? ' is-active' : ''}`}
            onClick={() => setTestimonialConsent('no')}
          >
            {f.testimonial.no}
          </button>
        </div>
        {testimonialConsent === 'yes' ? (
          <>
            <label className="fb-field">
              <span>{f.testimonial.displayLabel}</span>
              <select
                value={testimonialDisplayPreference}
                onChange={(e) =>
                  setTestimonialDisplayPreference(e.target.value as 'full_name' | 'first_initial' | 'anonymous')
                }
              >
                <option value="full_name">{f.testimonial.displayFullName}</option>
                <option value="first_initial">{f.testimonial.displayFirstInitial}</option>
                <option value="anonymous">{f.testimonial.displayAnonymous}</option>
              </select>
            </label>
            {testimonialDisplayPreference === 'full_name' ? (
              <label className="fb-field">
                <span>{f.testimonial.nameLabel}</span>
                <input
                  value={testimonialDisplayName}
                  onChange={(e) => setTestimonialDisplayName(e.target.value)}
                  maxLength={80}
                  placeholder={f.testimonial.namePlaceholder}
                />
              </label>
            ) : null}
            <label className="fb-field">
              <span>{f.testimonial.roleLabel}</span>
              <input
                value={testimonialRole}
                onChange={(e) => setTestimonialRole(e.target.value)}
                maxLength={80}
                placeholder={f.testimonial.rolePlaceholder}
              />
            </label>
          </>
        ) : null}
      </fieldset>
    )
  }

  const issueOptions = useMemo(
    () =>
      SUPPORT_ISSUE_TYPES.map((item) => ({
        id: item.id,
        label: t.accountSupport.issueTypes[item.id as keyof typeof t.accountSupport.issueTypes] ?? item.id,
      })),
    [t.accountSupport.issueTypes],
  )

  async function handleTicketSubmit() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) return
    await runAction(async () => {
      const res = await createSupportTicket({
        issueType: ticketIssueType,
        subject: ticketSubject,
        message: ticketMessage,
        source: 'website',
        surface: 'support',
        locale,
        metadata: includeDiagnostics
          ? {
              includeDiagnostics: true,
              userAgent: navigator.userAgent.slice(0, 300),
              extensionVersion: searchParams.get('extVersion')?.slice(0, 32) ?? undefined,
            }
          : undefined,
      })
      if (res.ok) {
        setCreatedTicketNumber(res.body.ticket.displayNumber)
        setTicketSubject('')
        setTicketMessage('')
      }
      return res.ok ? { ok: true } : { ok: false, error: res.error }
    }, 'support_ticket_created')
  }

  if (!signedIn) {
    return (
      <div className="fb-hub fl-surface-1">
        <h2>{f.signInTitle}</h2>
        <p className="muted">{f.signInBody}</p>
        <div className="btn-row">
          <Button to="/account">{f.signInCta}</Button>
          <Button variant="secondary" to="/support">
            {f.supportLink}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fb-hub">
      <div className="fb-tabs" role="tablist" aria-label={f.tabsAria}>
        {(
          [
            ['feedback', f.tabs.feedback],
            ['features', f.tabs.features],
            ['support', f.tabs.support],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`fb-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="fl-alert fl-alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="fl-alert fl-alert-success" role="status">
          {success}
        </p>
      ) : null}

      {tab === 'feedback' ? (
        <section className="fl-surface-1 fb-panel" aria-labelledby="fb-rating-title">
          <h2 id="fb-rating-title">{f.ratingTitle}</h2>
          <p className="muted">{f.ratingLead}</p>
          <StarRating value={rating} onChange={setRating} label={f.ratingAria} disabled={loading} />
          {rating ? (
            <div className="fb-followup">
              <p>{rating <= 3 ? f.improveQuestion : f.likeQuestion}</p>
              {rating <= 3 ? (
                <div className="fb-chip-row">
                  {improveCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`fb-chip${ratingCategory === cat.id ? ' is-active' : ''}`}
                      onClick={() => setRatingCategory(cat.id)}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="fb-field">
                <span>{f.messageLabel}</span>
                <textarea
                  value={ratingMessage}
                  onChange={(e) => setRatingMessage(e.target.value)}
                  rows={3}
                  maxLength={4000}
                />
              </label>
              <TestimonialConsentFields />
              <Button type="button" disabled={loading} onClick={() => void handleRatingSubmit()}>
                {f.send}
              </Button>
            </div>
          ) : null}

          <hr className="fb-divider" />

          <h3>{f.generalTitle}</h3>
          <label className="fb-field">
            <span>{f.typeLabel}</span>
            <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value)}>
              {f.types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fb-field">
            <span>{f.messageLabel}</span>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              rows={4}
              maxLength={4000}
              placeholder={f.messagePlaceholder}
            />
          </label>
          <TestimonialConsentFields />
          <Button type="button" disabled={loading || !feedbackMessage.trim()} onClick={() => void handleFeedbackSubmit()}>
            {f.sendFeedback}
          </Button>

          {config?.storeReviewAvailable && config.chromeWebStoreUrl ? (
            <aside className="fb-store-cta fl-surface-1">
              <h3>{f.storeTitle}</h3>
              <p className="muted">{f.storeBody}</p>
              <a
                className="btn btn-secondary"
                href={config.chromeWebStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => emitFeedbackEvent('store_review_cta_clicked')}
              >
                {f.storeCta}
              </a>
            </aside>
          ) : (
            <p className="muted fb-store-placeholder">{f.storeUnavailable}</p>
          )}
        </section>
      ) : null}

      {tab === 'features' ? (
        <section className="fl-surface-1 fb-panel" aria-labelledby="fb-features-title">
          <h2 id="fb-features-title">{f.featuresTitle}</h2>
          <p className="muted">{f.featuresLead}</p>
          <div className="fb-suggestions">
            {FEATURE_SUGGESTIONS.map((idea) => (
              <button
                key={idea}
                type="button"
                className="fb-chip"
                onClick={() => {
                  setFeatureTitle(idea)
                  if (!featureDescription) setFeatureDescription(f.featureSuggestionHint)
                }}
              >
                {idea}
              </button>
            ))}
          </div>
          <label className="fb-field">
            <span>{f.featureTitleLabel}</span>
            <input value={featureTitle} onChange={(e) => setFeatureTitle(e.target.value)} maxLength={120} />
          </label>
          <label className="fb-field">
            <span>{f.featureDescLabel}</span>
            <textarea
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>
          <Button
            type="button"
            disabled={loading || !featureTitle.trim() || !featureDescription.trim()}
            onClick={() => void handleFeatureSubmit()}
          >
            {f.suggestFeature}
          </Button>

          <div className="fb-feature-list">
            {features.length === 0 ? (
              <p className="muted">{f.noFeatures}</p>
            ) : (
              features.map((item) => (
                <article key={item.id} className="fb-feature-card fl-surface-1">
                  <div className="fb-feature-head">
                    <h3>{item.title}</h3>
                    <span className="fb-badge">{f.status[item.status as keyof typeof f.status] ?? item.status}</span>
                  </div>
                  <p>{item.description}</p>
                  <div className="fb-feature-foot">
                    <span>{f.votesLabel.replace('{count}', String(item.voteCount))}</span>
                    <button type="button" className="btn btn-secondary" disabled={loading || item.votedByMe} onClick={() => void handleVote(item.id)}>
                      {item.votedByMe ? f.voted : f.vote}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      ) : null}

      {tab === 'support' ? (
        <section className="fl-surface-1 fb-panel" aria-labelledby="fb-support-title">
          <h2 id="fb-support-title">{f.supportTitle}</h2>
          <p className="muted">{f.supportLead}</p>
          <p className="muted">
            <Link to="/support">{f.supportDocs}</Link>
            {' · '}
            <Link to="/account/support">{f.viewRequests}</Link>
          </p>
          {createdTicketNumber ? (
            <p className="fl-alert fl-alert-success" role="status">
              {f.ticketCreated.replace('{number}', createdTicketNumber)}
            </p>
          ) : null}
          <label className="fb-field">
            <span>{f.ticketIssueType}</span>
            <select value={ticketIssueType} onChange={(e) => setTicketIssueType(e.target.value)}>
              {issueOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fb-field">
            <span>{f.ticketSubject}</span>
            <input value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} maxLength={120} />
          </label>
          <label className="fb-field">
            <span>{f.ticketMessage}</span>
            <textarea value={ticketMessage} onChange={(e) => setTicketMessage(e.target.value)} rows={5} maxLength={4000} />
          </label>
          <label className="fb-check">
            <input type="checkbox" checked={includeDiagnostics} onChange={(e) => setIncludeDiagnostics(e.target.checked)} />
            <span>{f.diagnosticsLabel}</span>
          </label>
          {includeDiagnostics ? <p className="muted fb-diagnostics-note">{f.diagnosticsNote}</p> : null}
          <Button
            type="button"
            disabled={loading || !ticketSubject.trim() || !ticketMessage.trim()}
            onClick={() => void handleTicketSubmit()}
          >
            {f.sendTicket}
          </Button>
        </section>
      ) : null}
    </div>
  )
}
