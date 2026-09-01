import { useEffect, useMemo, useState } from 'react'
import {
  FLOWLARY_PRICING,
  formatUsdFromCents,
  type BillingInterval,
} from '@flowlary/shared'
import { Badge, Button, GetFlowlaryButton } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'
import {
  beginProCheckout,
  catalogDisplayPrice,
  loadBillingConfigSafe,
  resolveCommercialPlanState,
} from '../../account/billing.ts'
import {
  loadWebAccount,
  type BillingConfigView,
  type WebAccountView,
  type WebEntitlementView,
} from '../../account/client.ts'
import { emitPricingEvent } from '../../lib/pricingEvents.ts'
import { StudentProgramSection } from './StudentProgramSection.tsx'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.5 8.2 6.4 11l6.1-6.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M10 2.5 4.5 4.8v5.2c0 3.2 2.2 5.5 5.5 7.5 3.3-2 5.5-4.3 5.5-7.5V4.8L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlanFeatures({ items, highlightFirst = false }: { items: readonly string[]; highlightFirst?: boolean }) {
  return (
    <ul className="pr-features">
      {items.map((item, index) => (
        <li key={item} className={highlightFirst && index === 0 ? 'is-highlight' : undefined}>
          <span className="pr-feature-icon">
            <CheckIcon />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PricingShowcase() {
  const t = useMessages()
  const p = t.pricing
  const [billing, setBilling] = useState<BillingConfigView | null>(null)
  const [account, setAccount] = useState<WebAccountView | null>(null)
  const [entitlement, setEntitlement] = useState<WebEntitlementView | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    emitPricingEvent('pricing_view')
    let cancelled = false
    void (async () => {
      const [config, session] = await Promise.all([loadBillingConfigSafe(), loadWebAccount()])
      if (cancelled) return
      if (config) setBilling(config)
      if (session.ok) {
        setAccount(session.account)
        setEntitlement(session.entitlement)
      }
      setSessionLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pricingVars = useMemo(
    () => ({
      freeDaily: FLOWLARY_PRICING.freeDailyCredits,
      proDaily: FLOWLARY_PRICING.proDailyCredits,
      trialDaily: FLOWLARY_PRICING.trialDailyCredits,
      count: FLOWLARY_PRICING.proDailyCredits,
      saveAmount: formatUsdFromCents(FLOWLARY_PRICING.yearlySavingsCents),
      amount: formatUsdFromCents(FLOWLARY_PRICING.yearlyEquivalentMonthlyCents),
      monthly: formatUsdFromCents(FLOWLARY_PRICING.monthly.amountCents),
      yearly: formatUsdFromCents(FLOWLARY_PRICING.yearly.amountCents),
    }),
    [],
  )

  const planState = resolveCommercialPlanState({
    loading: sessionLoading,
    account,
    entitlement,
  })
  const studentProActive = entitlement?.studentProActive === true
  const checkoutReady = billing?.checkoutAvailable === true
  const yearlyReady = billing?.yearlyCheckoutAvailable === true
  const monthlyDisplay = catalogDisplayPrice(
    billing?.proPriceMonthly ?? billing?.proPrice ?? null,
    FLOWLARY_PRICING.monthly.amountCents,
  )
  const yearlyDisplay = catalogDisplayPrice(
    billing?.proPriceYearly ?? null,
    FLOWLARY_PRICING.yearly.amountCents,
  )
  const selectedPrice = interval === 'year' ? yearlyDisplay : monthlyDisplay
  const selectedCadence = interval === 'year' ? p.pro.yearlyCadence : p.pro.cadence
  const savingsPositive = FLOWLARY_PRICING.yearlySavingsCents > 0
  const saveLabel = savingsPositive
    ? `${p.interval.savePrefix} ${fill(p.interval.saveLabel, pricingVars)}`
    : ''
  const equivalentMonthly = fill(p.interval.equivalentMonthly, pricingVars)

  const proCta = useMemo(() => {
    if (planState === 'loading') return { label: t.account.billingChecking, kind: 'disabled' as const }
    if (studentProActive) {
      return { label: p.pro.ctaStudentActive, kind: 'account' as const }
    }
    if (planState === 'pro' || planState === 'cancel_at_period_end') {
      return { label: p.pro.ctaManage, kind: 'account' as const }
    }
    if (planState === 'past_due' || planState === 'payment_failed') {
      return { label: p.pro.ctaFixBilling, kind: 'account' as const }
    }
    if (planState === 'trial') {
      return {
        label: checkoutReady ? p.pro.ctaUpgrade : p.pro.ctaTrial,
        kind: checkoutReady ? ('checkout' as const) : ('register' as const),
      }
    }
    if (planState === 'free' || planState === 'expired') {
      return {
        label: checkoutReady ? p.pro.ctaUpgrade : p.createAccountLabel,
        kind: checkoutReady ? ('checkout' as const) : ('register' as const),
      }
    }
    return {
      label: checkoutReady ? p.pro.ctaTrial : p.createAccountLabel,
      kind: 'register' as const,
    }
  }, [checkoutReady, p, planState, studentProActive, t.account.billingChecking])

  async function onProAction() {
    setError(null)
    emitPricingEvent('pro_cta_click')
    if (proCta.kind === 'account') {
      window.location.assign('/account')
      return
    }
    if (proCta.kind === 'register' && !account) {
      window.location.assign('/account?mode=register')
      return
    }
    if (proCta.kind === 'checkout' || (account && checkoutReady)) {
      if (!account) {
        window.location.assign('/account?mode=register&next=checkout')
        return
      }
      if (interval === 'year' && !yearlyReady) {
        setError(p.interval.yearlyUnavailable)
        return
      }
      setBusy(true)
      const result = await beginProCheckout(interval)
      setBusy(false)
      if (!result.ok) {
        if (result.reason === 'auth') setError(t.account.billingAuthRequired)
        else if (result.reason === 'already_pro') setError(t.account.billingAlreadyPro)
        else if (result.reason === 'email_not_verified') setError(t.account.billingVerifyEmailRequired)
        else if (result.reason === 'checkout_failed') setError(t.account.billingCheckoutFailed)
        else if (!checkoutReady) setError(t.account.billingPrepared)
        else setError(t.account.billingCheckoutFailed)
      }
    }
  }

  const freeItems = p.free.items.map((item) => fill(item, { count: FLOWLARY_PRICING.freeDailyCredits }))
  const proItems = p.pro.items.map((item) => fill(item, { count: FLOWLARY_PRICING.proDailyCredits }))
  const trialSteps = p.trial.steps.map((step) =>
    fill(step.body, {
      count: FLOWLARY_PRICING.trialDailyCredits,
      freeDaily: FLOWLARY_PRICING.freeDailyCredits,
    }),
  )
  const faqItems = p.faq.items.map((item) => ({
    q: fill(item.q, pricingVars),
    a: fill(item.a, pricingVars),
  }))

  return (
    <div className="pp-page pr-page">
      <header className="pp-hero pr-hero">
        <div className="container pr-hero-inner">
          <Reveal>
            <div className="pr-hero-copy">
              <p className="pr-kicker">{p.kicker}</p>
              <h1>{p.title}</h1>
              <p className="lead">{p.lead}</p>
              <p className="pr-student-hero-link">
                <a href="#students">{p.studentHeroLink}</a>
              </p>
            </div>
          </Reveal>
        </div>
      </header>

      <section className="section pr-body">
        <div className="container pr-shell">
          <Reveal>
            <div className="pr-interval-wrap">
              <div className="pr-interval" role="group" aria-label={p.interval.yearlyHint ?? p.interval.yearly}>
                <button
                  type="button"
                  className={`pr-interval-btn${interval === 'month' ? ' is-active' : ''}`}
                  aria-pressed={interval === 'month'}
                  onClick={() => {
                    setInterval('month')
                    emitPricingEvent('billing_monthly_selected')
                  }}
                >
                  {p.interval.monthly}
                </button>
                <button
                  type="button"
                  className={`pr-interval-btn${interval === 'year' ? ' is-active' : ''}`}
                  aria-pressed={interval === 'year'}
                  onClick={() => {
                    setInterval('year')
                    emitPricingEvent('billing_yearly_selected')
                  }}
                >
                  {p.interval.yearly}
                  {savingsPositive ? <span className="pr-interval-save">{saveLabel}</span> : null}
                </button>
              </div>
            </div>
          </Reveal>
          <p className="pr-interval-summary">{fill(p.interval.annualSummary, pricingVars)}</p>

          <div className="pr-grid">
            <Reveal>
              <article className="pr-surface pr-card">
                <div className="pr-card-head">
                  <p className="pr-plan-kicker">{p.free.kicker}</p>
                </div>
                <h2 className="pr-plan-name">{p.free.title}</h2>
                <p className="pr-card-headline">{p.free.headline}</p>
                <div className="pr-price">
                  <strong>{p.free.price}</strong>
                  <span>{p.free.cadence}</span>
                </div>
                <p className="pr-allowance">{fill(p.free.allowance, { count: FLOWLARY_PRICING.freeDailyCredits })}</p>
                <p className="pr-card-body">{p.free.body}</p>
                <PlanFeatures items={freeItems} highlightFirst />
                <div className="pr-card-actions">
                  <Button
                    variant="secondary"
                    to="/account?mode=register"
                    className="pr-card-btn"
                    onClick={() => emitPricingEvent('free_cta_click')}
                  >
                    {p.free.cta}
                  </Button>
                </div>
              </article>
            </Reveal>
            <Reveal>
              <article className="pr-surface pr-card is-pro is-featured">
                <div className="pr-pro-badge-row">
                  <Badge tone="accent">{p.pro.badge}</Badge>
                </div>
                <div className="pr-card-body-wrap">
                  <div className="pr-card-head">
                    <p className="pr-plan-kicker">{p.pro.kicker}</p>
                  </div>
                  <h2 className="pr-plan-name">{p.pro.title}</h2>
                  <p className="pr-card-headline">{p.pro.valueHeadline}</p>
                  <div className="pr-offer-price">
                    <div className="pr-price is-hook">
                      <strong>{selectedPrice}</strong>
                      <span>{selectedCadence}</span>
                    </div>
                    {interval === 'year' && yearlyReady && savingsPositive ? (
                      <p className="pr-price-after">
                        {equivalentMonthly} · {saveLabel}
                      </p>
                    ) : savingsPositive ? (
                      <p className="pr-price-after">{saveLabel}</p>
                    ) : null}
                    <p className="pr-allowance">{fill(p.pro.allowance, { count: FLOWLARY_PRICING.proDailyCredits })}</p>
                  </div>
                  <p className="pr-card-body">{p.pro.body}</p>
                  <PlanFeatures items={proItems} highlightFirst />
                  <div className="pr-card-actions">
                    <Button
                      className="pr-card-btn pr-card-btn-primary"
                      disabled={busy || proCta.kind === 'disabled' || (!checkoutReady && proCta.kind === 'checkout')}
                      onClick={() => void onProAction()}
                    >
                      {busy ? t.account.billingChecking : proCta.label}
                    </Button>
                    {!checkoutReady ? (
                      <Button variant="secondary" to="/account" disabled aria-disabled="true" className="pr-card-btn">
                        {p.upgradePendingLabel}
                      </Button>
                    ) : null}
                    <p className="pr-card-note">{checkoutReady ? p.checkoutReadyNote : p.checkoutPendingNote}</p>
                    {error ? (
                      <p className="pr-card-error" role="alert">
                        {error}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            </Reveal>
          </div>

          <StudentProgramSection signedIn={Boolean(account)} />

          <Reveal>
            <section className="pr-surface pr-trial" aria-labelledby="pr-trial-title">
              <p className="pr-plan-kicker">{p.trialCard.kicker}</p>
              <h2 id="pr-trial-title">{p.trial.title}</h2>
              <p className="pr-card-body">{p.trial.intro}</p>
              <ol className="pr-trial-steps">
                {p.trial.steps.map((step, index) => (
                  <li key={step.title}>
                    <strong>{step.title}</strong>
                    <span>{trialSteps[index]}</span>
                  </li>
                ))}
              </ol>
              <p className="pr-card-note">{p.trialCard.noCard}</p>
              <p className="pr-card-body">{p.trial.note}</p>
              <Button
                to="/account?mode=register"
                className="pr-trial-btn"
                onClick={() => emitPricingEvent('trial_cta_click')}
              >
                {p.trialCard.cta}
              </Button>
            </section>
          </Reveal>

          <Reveal>
            <div id="pr-compare" className="pr-compare-section">
              <header className="pr-section-head">
                <h2>{p.compare.title}</h2>
              </header>
              <div className="pr-surface pr-compare-wrap">
                <div className="pr-compare-scroll">
                  <table className="pr-compare">
                    <caption className="visually-hidden">{p.compare.title}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{p.compare.featureCol}</th>
                        <th scope="col" className="pr-col-plan">{p.compare.freeCol}</th>
                        <th scope="col" className="pr-col-plan pr-col-pro">{p.compare.proCol}</th>
                      </tr>
                    </thead>
                    {p.compare.categories.map((category) => (
                      <tbody key={category.title}>
                        <tr className="pr-compare-category-row">
                          <th scope="rowgroup" colSpan={3}>{category.title}</th>
                        </tr>
                        {category.rows.map((row) => (
                          <tr key={row.feature}>
                            <th scope="row">{row.feature}</th>
                            <td className="pr-col-plan">{fill(row.free, pricingVars)}</td>
                            <td className="pr-col-plan pr-col-pro">{fill(row.pro, pricingVars)}</td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <article className="pr-surface pr-ai-usage">
              <h2>{p.aiUsage.title}</h2>
              <p className="pr-ai-lead">{p.aiUsage.lead}</p>
              <p>{p.aiUsage.body}</p>
              <ul className="pr-ai-bullets">
                {p.aiUsage.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <h3>{p.aiUsage.longFormTitle}</h3>
              <p>{p.aiUsage.longFormBody}</p>
              <h3>{p.aiUsage.exhaustionTitle}</h3>
              <p>{p.aiUsage.exhaustionBody}</p>
            </article>
          </Reveal>

          <Reveal>
            <article className="pr-surface pr-billing">
              <div className="pr-billing-icon" aria-hidden="true">
                <ShieldIcon />
              </div>
              <div>
                <h2>{p.billing.title}</h2>
                <p>{fill(p.billing.body, pricingVars)}</p>
              </div>
            </article>

            {p.trust?.length ? (
              <div className="pr-trust-row">
                {p.trust.map((item) => (
                  <article key={item.label} className="pr-trust-card fl-surface-1">
                    <h3>{item.label}</h3>
                    <p>{item.detail}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </Reveal>

          <Reveal>
            <section className="pr-faq" aria-labelledby="pr-faq-title">
              <h2 id="pr-faq-title">{p.faq.title}</h2>
              <div className="pr-faq-list">
                {faqItems.map((item) => (
                  <details
                    key={item.q}
                    className="pr-surface pr-faq-item"
                    onToggle={(event) => {
                      if ((event.target as HTMLDetailsElement).open) emitPricingEvent('faq_opened')
                    }}
                  >
                    <summary>{item.q}</summary>
                    <p>{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </Reveal>
        </div>
      </section>

      <section className="pr-final">
        <div className="container pr-shell">
          <Reveal>
            <div className="pr-surface pr-final-card">
              <h2>{p.final.title}</h2>
              <p>{p.final.lead}</p>
              <div className="btn-row pr-final-actions">
                <Button to="/account?mode=register" onClick={() => emitPricingEvent('free_cta_click')}>
                  {p.final.ctaFree}
                </Button>
                <GetFlowlaryButton variant="secondary" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
