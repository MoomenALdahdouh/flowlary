import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { FeatureRequestPublicView, FeedbackConfigView } from '@flowlary/shared'
import { SATISFACTION_IMPROVE_CATEGORIES, SUPPORT_ISSUE_TYPES } from '@flowlary/shared'
import { Bug, Lightbulb, Star } from 'lucide-react'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { hasStoredWebSession } from '../../account/client.ts'
import { StarRating } from './StarRating.tsx'
import {
  createFeatureRequest,
  createSupportTicket,
  fetchFeatureRequests,
  fetchFeedbackConfigPublic,
  fetchPublicFeatureRequests,
  submitFeedback,
  submitRating,
  voteFeatureRequest,
} from '../../feedback/client.ts'
import { emitFeedbackEvent } from '../../lib/feedbackEvents.ts'
import { feedbackNextFromTab } from '../../account/safeNext.ts'
import { clearFeedbackDraft, readFeedbackDraft, saveFeedbackDraft } from '../../feedback/draft.ts'

export type FeedbackTab = 'feedback' | 'features' | 'support'

type PublicIdea = {
  id: string
  title: string
  voteCount: number
  status: string
}

function fieldClass() {
  return 'field-input'
}

function PublicIdeasList({
  ideas,
  empty,
  votesLabel,
  voteCta,
  next,
}: {
  ideas: PublicIdea[]
  empty: string
  votesLabel: string
  voteCta: string
  next: string
}) {
  if (ideas.length === 0) {
    return <p className="text-sm text-slate-500">{empty}</p>
  }
  return (
    <div className="space-y-3">
      {ideas.map((item) => (
        <article
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
        >
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h4>
            <p className="mt-1 text-xs text-slate-500">{votesLabel.replace('{count}', String(item.voteCount))}</p>
          </div>
          <Link to={`/account?next=${next}`} className="btn-secondary text-xs">
            {voteCta}
          </Link>
        </article>
      ))}
    </div>
  )
}

function AccountHint({ tab }: { tab: FeedbackTab }) {
  const f = useMessages().feedback
  const next = feedbackNextFromTab(tab)
  return (
    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      {f.accountToSend}{' '}
      <Link to={`/account?mode=register&next=${next}`} className="font-semibold text-sky-600 dark:text-sky-400">
        {f.createAccountCta}
      </Link>
      {' · '}
      <Link to={`/account?next=${next}`} className="font-semibold text-sky-600 dark:text-sky-400">
        {f.signInCta}
      </Link>
    </p>
  )
}

export function FeedbackHub({ initialTab = 'feedback' }: { initialTab?: FeedbackTab }) {
  const t = useMessages()
  const f = t.feedback
  const { locale } = useI18n()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const signedIn = hasStoredWebSession()

  const tab: FeedbackTab =
    searchParams.get('tab') === 'features' || searchParams.get('tab') === 'support'
      ? (searchParams.get('tab') as FeedbackTab)
      : initialTab === 'features' || initialTab === 'support'
        ? initialTab
        : 'feedback'

  function selectTab(id: FeedbackTab) {
    const next = new URLSearchParams(searchParams)
    if (id === 'feedback') next.delete('tab')
    else next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

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
  const [publicIdeas, setPublicIdeas] = useState<PublicIdea[]>([])

  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [ticketIssueType, setTicketIssueType] = useState('GENERAL')
  const [createdTicketNumber, setCreatedTicketNumber] = useState<string | null>(null)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(false)
  const [draftReady, setDraftReady] = useState(false)

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
    if (signedIn) return
    void fetchPublicFeatureRequests().then((res) => {
      if (!res.ok) return
      setPublicIdeas(
        res.body.items.map((item) => ({
          id: item.id,
          title: item.title,
          voteCount: item.voteCount,
          status: item.status,
        })),
      )
    })
  }, [signedIn])

  useEffect(() => {
    if (!signedIn || tab !== 'features') return
    void fetchFeatureRequests().then((res) => {
      if (res.ok) setFeatures(res.body.items)
    })
  }, [signedIn, tab])

  useEffect(() => {
    if (!signedIn) return
    const draft = readFeedbackDraft()
    if (!draft) return
    setRating(draft.rating)
    setRatingCategory(draft.ratingCategory)
    setRatingMessage(draft.ratingMessage)
    setFeedbackType(draft.feedbackType)
    setFeedbackMessage(draft.feedbackMessage)
    setFeatureTitle(draft.featureTitle)
    setFeatureDescription(draft.featureDescription)
    setTicketSubject(draft.ticketSubject)
    setTicketMessage(draft.ticketMessage)
    setTicketIssueType(draft.ticketIssueType)
    setIncludeDiagnostics(draft.includeDiagnostics)
    if (draft.tab === 'features' || draft.tab === 'support') {
      const next = new URLSearchParams(window.location.search)
      next.set('tab', draft.tab)
      setSearchParams(next, { replace: true })
    }
    setDraftReady(true)
    clearFeedbackDraft()
  }, [signedIn, setSearchParams])

  function persistDraft(activeTab: FeedbackTab = tab) {
    saveFeedbackDraft({
      tab: activeTab,
      rating,
      ratingCategory,
      ratingMessage,
      feedbackType,
      feedbackMessage,
      featureTitle,
      featureDescription,
      ticketSubject,
      ticketMessage,
      ticketIssueType,
      includeDiagnostics,
    })
  }

  function requireAccount(activeTab: FeedbackTab): boolean {
    if (signedIn) return true
    persistDraft(activeTab)
    navigate(`/account?mode=register&next=${feedbackNextFromTab(activeTab)}`)
    return false
  }

  const improveCategories = useMemo(
    () =>
      SATISFACTION_IMPROVE_CATEGORIES.map((id) => ({
        id,
        label: f.categories[id as keyof typeof f.categories] ?? id,
      })),
    [f.categories],
  )

  const issueOptions = useMemo(
    () =>
      SUPPORT_ISSUE_TYPES.map((item) => ({
        id: item.id,
        label: t.accountSupport.issueTypes[item.id as keyof typeof t.accountSupport.issueTypes] ?? item.id,
      })),
    [t.accountSupport.issueTypes],
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
    if (!requireAccount('feedback')) return
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
    if (!requireAccount('feedback')) return
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
    if (!requireAccount('features')) return
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
    if (!requireAccount('features')) return
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

  async function handleTicketSubmit() {
    if (!ticketSubject.trim() || !ticketMessage.trim()) return
    if (!requireAccount('support')) return
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

  function TestimonialConsentFields() {
    return (
      <fieldset className="rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
        <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{f.testimonial.question}</legend>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{f.testimonial.note}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={f.testimonial.question}>
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              testimonialConsent === 'yes'
                ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}
            onClick={() => setTestimonialConsent('yes')}
          >
            {f.testimonial.yes}
          </button>
          <button
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              testimonialConsent === 'no'
                ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
            }`}
            onClick={() => setTestimonialConsent('no')}
          >
            {f.testimonial.no}
          </button>
        </div>
        {testimonialConsent === 'yes' ? (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.testimonial.displayLabel}</span>
              <select
                className={fieldClass()}
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
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.testimonial.nameLabel}</span>
                <input
                  className={fieldClass()}
                  value={testimonialDisplayName}
                  onChange={(e) => setTestimonialDisplayName(e.target.value)}
                  maxLength={80}
                  placeholder={f.testimonial.namePlaceholder}
                />
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.testimonial.roleLabel}</span>
              <input
                className={fieldClass()}
                value={testimonialRole}
                onChange={(e) => setTestimonialRole(e.target.value)}
                maxLength={80}
                placeholder={f.testimonial.rolePlaceholder}
              />
            </label>
          </div>
        ) : null}
      </fieldset>
    )
  }

  const tabs = [
    { id: 'feedback' as const, label: f.tabs.feedback, icon: Star },
    { id: 'features' as const, label: f.tabs.features, icon: Lightbulb },
    { id: 'support' as const, label: f.tabs.support, icon: Bug },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={f.tabsAria}>
        {tabs.map((item) => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`fb-panel-${item.id}`}
              id={`fb-tab-${item.id}`}
              onClick={() => selectTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </div>

      <p className="rounded-xl border-s-4 border-sky-500 bg-sky-50 px-4 py-3 text-sm text-slate-600 dark:bg-sky-500/10 dark:text-slate-300">
        {f.escalationNote}{' '}
        <Link to="/contact" className="font-semibold text-sky-600 dark:text-sky-400">
          {f.escalationContact}
        </Link>
        {' · '}
        <Link to="/support" className="font-semibold text-sky-600 dark:text-sky-400">
          {f.supportDocs}
        </Link>
      </p>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300" role="status">
          {success}
        </p>
      ) : null}

      {draftReady ? (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200" role="status">
          {f.draftReady}
        </p>
      ) : null}

      {tab === 'feedback' ? (
        <section className="space-y-8" id="fb-panel-feedback" role="tabpanel" aria-labelledby="fb-tab-feedback">
          <div>
            <h2 id="fb-rating-title" className="text-xl font-bold text-slate-900 dark:text-white">
              {f.ratingTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{f.ratingLead}</p>
          </div>
          <StarRating value={rating} onChange={setRating} label={f.ratingAria} disabled={loading} />
              {rating ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {rating <= 3 ? f.improveQuestion : f.likeQuestion}
                  </p>
                  {rating <= 3 ? (
                    <div className="flex flex-wrap gap-2">
                      {improveCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            ratingCategory === cat.id
                              ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300'
                              : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                          }`}
                          onClick={() => setRatingCategory(cat.id)}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.messageLabel}</span>
                    <textarea
                      className={`${fieldClass()} min-h-[6rem] resize-y`}
                      value={ratingMessage}
                      onChange={(e) => setRatingMessage(e.target.value)}
                      rows={3}
                      maxLength={4000}
                    />
                    <span className="mt-1 block text-end text-[11px] text-slate-400">{ratingMessage.length}/4000</span>
                  </label>
                  <TestimonialConsentFields />
                  <button type="button" className="btn-primary" disabled={loading} onClick={() => void handleRatingSubmit()}>
                    {loading ? f.sending : f.send}
                  </button>
                  {!signedIn ? <AccountHint tab="feedback" /> : null}
                </div>
              ) : null}

              <hr className="border-slate-200 dark:border-slate-800" />

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{f.generalTitle}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {f.types.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFeedbackType(item.id)}
                      className={`rounded-xl border px-3 py-3 text-xs font-semibold ${
                        feedbackType === item.id
                          ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-300'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.messageLabel}</span>
                  <textarea
                    className={`${fieldClass()} min-h-[8rem] resize-y`}
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    rows={5}
                    maxLength={4000}
                    placeholder={f.messagePlaceholder}
                  />
                  <span className="mt-1 block text-end text-[11px] text-slate-400">{feedbackMessage.length}/4000</span>
                </label>
                <TestimonialConsentFields />
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  disabled={loading || !feedbackMessage.trim()}
                  onClick={() => void handleFeedbackSubmit()}
                >
                  {loading ? f.sending : f.sendFeedback}
                </button>
                {!signedIn ? <AccountHint tab="feedback" /> : null}
              </div>

              {config?.storeReviewAvailable && config.chromeWebStoreUrl ? (
                <aside className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{f.storeTitle}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.storeBody}</p>
                  <a
                    className="btn-secondary mt-4 text-sm"
                    href={config.chromeWebStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => emitFeedbackEvent('store_review_cta_clicked')}
                  >
                    {f.storeCta}
                  </a>
                </aside>
              ) : null}

              {!signedIn ? (
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{f.trendingIdeas}</h3>
                  <div className="mt-3">
                    <PublicIdeasList
                      ideas={publicIdeas}
                      empty={f.publicBoardEmpty}
                      votesLabel={f.votesLabel}
                      voteCta={f.voteSignIn}
                      next={feedbackNextFromTab('features')}
                    />
                  </div>
                </div>
              ) : null}
        </section>
      ) : null}

      {tab === 'features' ? (
        <section className="space-y-6" id="fb-panel-features" role="tabpanel" aria-labelledby="fb-tab-features">
          <div>
            <h2 id="fb-features-title" className="text-xl font-bold text-slate-900 dark:text-white">
              {f.featuresTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{f.featuresLead}</p>
          </div>

              <div className="flex flex-wrap gap-2">
                {f.featureSuggestions.map((idea) => (
                  <button
                    key={idea}
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-sky-200 hover:text-sky-600 dark:border-slate-700 dark:text-slate-300"
                    onClick={() => {
                      setFeatureTitle(idea)
                      if (!featureDescription) setFeatureDescription(f.featureSuggestionHint)
                    }}
                  >
                    {idea}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.featureTitleLabel}</span>
                <input
                  className={fieldClass()}
                  value={featureTitle}
                  onChange={(e) => setFeatureTitle(e.target.value)}
                  maxLength={120}
                  placeholder={f.featureTitlePlaceholder}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.featureDescLabel}</span>
                <textarea
                  className={`${fieldClass()} min-h-[6rem] resize-y`}
                  value={featureDescription}
                  onChange={(e) => setFeatureDescription(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={f.featureDescPlaceholder}
                />
                <span className="mt-1 block text-end text-[11px] text-slate-400">{featureDescription.length}/2000</span>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={loading || !featureTitle.trim() || !featureDescription.trim()}
                onClick={() => void handleFeatureSubmit()}
              >
                {loading ? f.sending : f.suggestFeature}
              </button>
              {!signedIn ? <AccountHint tab="features" /> : null}
              <div className="space-y-3">
                {signedIn ? (
                  features.length === 0 ? (
                    <p className="text-sm text-slate-500">{f.noFeatures}</p>
                  ) : (
                    features.map((item) => (
                      <article key={item.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {f.status[item.status as keyof typeof f.status] ?? item.status}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-500">{f.votesLabel.replace('{count}', String(item.voteCount))}</span>
                          <button
                            type="button"
                            className="btn-secondary text-xs"
                            disabled={loading || item.votedByMe}
                            onClick={() => void handleVote(item.id)}
                          >
                            {item.votedByMe ? f.voted : f.vote}
                          </button>
                        </div>
                      </article>
                    ))
                  )
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{f.publicBoardTitle}</h3>
                    <PublicIdeasList
                      ideas={publicIdeas}
                      empty={f.publicBoardEmpty}
                      votesLabel={f.votesLabel}
                      voteCta={f.voteSignIn}
                      next={feedbackNextFromTab('features')}
                    />
                  </>
                )}
              </div>
        </section>
      ) : null}

      {tab === 'support' ? (
        <section className="space-y-6" id="fb-panel-support" role="tabpanel" aria-labelledby="fb-tab-support">
          <div>
            <h2 id="fb-support-title" className="text-xl font-bold text-slate-900 dark:text-white">
              {f.supportTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{f.supportLead}</p>
          </div>
              {createdTicketNumber ? (
                <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300" role="status">
                  {f.ticketCreated.replace('{number}', createdTicketNumber)}
                </p>
              ) : null}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.ticketIssueType}</span>
                <select className={fieldClass()} value={ticketIssueType} onChange={(e) => setTicketIssueType(e.target.value)}>
                  {issueOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.ticketSubject}</span>
                <input
                  className={fieldClass()}
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  maxLength={160}
                  placeholder={f.ticketSubjectPlaceholder}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-slate-500">{f.ticketMessage}</span>
                <textarea
                  className={`${fieldClass()} min-h-[9rem] resize-y`}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  rows={6}
                  maxLength={4000}
                />
                <span className="mt-1 block text-end text-[11px] text-slate-400">{ticketMessage.length}/4000</span>
              </label>
              <label className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={includeDiagnostics}
                  onChange={(e) => setIncludeDiagnostics(e.target.checked)}
                />
                <span>
                  {f.diagnosticsLabel}
                  <span className="mt-1 block text-xs text-slate-500">{f.diagnosticsNote}</span>
                </span>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={loading || !ticketSubject.trim() || !ticketMessage.trim()}
                onClick={() => void handleTicketSubmit()}
              >
                {loading ? f.sending : f.sendTicket}
              </button>
              {!signedIn ? <AccountHint tab="support" /> : null}
              <p className="text-sm">
                {signedIn ? (
                  <Link to="/dashboard/support" className="font-semibold text-sky-600 dark:text-sky-400">
                    {f.viewRequests}
                  </Link>
                ) : (
                  <Link to="/support" className="font-semibold text-sky-600 dark:text-sky-400">
                    {f.helpFirst}
                  </Link>
                )}
              </p>
        </section>
      ) : null}
    </div>
  )
}
