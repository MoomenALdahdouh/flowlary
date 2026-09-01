import { FLOWLARY_PRICING } from '@flowlary/shared'
import { Badge, Button } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'
import type { CommercialPlanState } from '../account/billing.ts'
import type { WebSubscriptionView } from '../account/client.ts'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="ac-bill-check">
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

type Props = {
  planState: CommercialPlanState
  planLabel: string
  isPro: boolean
  studentProActive: boolean
  inTrial: boolean
  trialDays: number | null
  subscription: WebSubscriptionView | undefined
  checkoutReady: boolean
  portalReady: boolean
  activating: boolean
  busy: 'checkout' | 'portal' | null
  billingMessage: string | null
  proPriceLabel: string | null
  onUpgrade: () => void
  onManageBilling: () => void
  onRefresh: () => void
}

export function AccountBillingPanel({
  planState,
  planLabel,
  isPro,
  studentProActive,
  inTrial,
  trialDays,
  subscription,
  checkoutReady,
  portalReady,
  activating,
  busy,
  billingMessage,
  proPriceLabel,
  onUpgrade,
  onManageBilling,
  onRefresh,
}: Props) {
  const copy = useMessages().account
  const bill = copy.billingPanel
  const pricingVars = {
    count: FLOWLARY_PRICING.proDailyCredits,
    freeCount: FLOWLARY_PRICING.freeDailyCredits,
    trialDays: FLOWLARY_PRICING.trialDays,
  }

  const proEquivalent = isPro || studentProActive
  const showProFeatures =
    proEquivalent || planState === 'cancel_at_period_end' || planState === 'past_due' || planState === 'payment_failed'
  const showTrialFeatures = inTrial && !proEquivalent
  const featureItems = (showProFeatures ? bill.proFeatures : showTrialFeatures ? bill.trialFeatures : bill.freeFeatures).map(
    (item) => fill(item, pricingVars),
  )

  const statusTone =
    planState === 'pro' || studentProActive
      ? 'ok'
      : planState === 'past_due' || planState === 'payment_failed'
        ? 'warn'
        : planState === 'cancel_at_period_end'
          ? 'default'
          : inTrial
            ? 'accent'
            : 'default'

  const metaCopy =
    planState === 'loading'
      ? copy.billingChecking
      : studentProActive && !isPro
        ? copy.student.activeMessage
        : planState === 'pro'
          ? copy.billingProLimits
          : planState === 'cancel_at_period_end'
            ? copy.billingCancelNote
            : planState === 'past_due'
              ? copy.billingPastDueMeta
              : planState === 'payment_failed'
                ? copy.billingPaymentFailedMeta
                : planState === 'expired'
                  ? copy.billingExpiredMeta
                  : inTrial
                    ? copy.trialEndsNote
                    : checkoutReady
                      ? copy.billingFreeCta
                      : copy.billingPreparedMeta

  const badgeLabel =
    studentProActive && !isPro
      ? copy.planStudentPro
      : planState === 'pro'
        ? copy.billingProActive
        : planState === 'cancel_at_period_end'
          ? copy.billingCancelScheduled
          : planState === 'past_due' || planState === 'payment_failed'
            ? copy.billingPastDue
            : inTrial
              ? copy.billingTrialLabel
              : copy.planFree

  return (
    <section className="ac-panel ac-bill-panel" aria-labelledby="ac-plan-title">
      <div className="ac-bill-head">
        <div>
          <h2 id="ac-plan-title">{copy.sectionPlan}</h2>
          <p className="ac-bill-plan-line">
            <span className="ac-dash-value">{planLabel}</span>
            {isPro && proPriceLabel ? <span className="ac-bill-price">{proPriceLabel}</span> : null}
            {inTrial && trialDays ? (
              <span className="ac-bill-trial-pill">{fill(copy.trialRemaining, { count: trialDays })}</span>
            ) : null}
          </p>
        </div>
        <Badge tone={statusTone}>{badgeLabel}</Badge>
      </div>

      <p className="ac-dash-meta">{metaCopy}</p>

      {subscription?.currentPeriodEnd && isPro ? (
        <p className="ac-dash-meta">
          {subscription.cancelAtPeriodEnd ? copy.billingCancelScheduled : copy.renewal}:{' '}
          {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
        </p>
      ) : null}

      {inTrial && !proEquivalent ? (
        <p className="ac-dash-meta">{fill(bill.trialCredits, pricingVars)}</p>
      ) : null}

      {activating ? (
        <p className="ac-alert is-neutral" role="status">
          {copy.billingActivating} {copy.notProYet}
        </p>
      ) : null}

      {billingMessage ? (
        <p className="ac-alert" role="alert">
          {billingMessage}
        </p>
      ) : null}

      <ul className="ac-bill-features">
        {featureItems.map((item) => (
          <li key={item}>
            <CheckIcon />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="ac-actions">
        {studentProActive && !isPro ? (
          <Button to="/pricing" variant="secondary">
            {copy.viewPlans}
          </Button>
        ) : planState === 'pro' ||
          planState === 'cancel_at_period_end' ||
          planState === 'past_due' ||
          planState === 'payment_failed' ? (
          <Button disabled={busy === 'portal' || !portalReady} onClick={onManageBilling}>
            {planState === 'past_due' || planState === 'payment_failed' ? copy.billingFix : copy.billingManage}
          </Button>
        ) : planState === 'trial' || planState === 'free' || planState === 'expired' ? (
          checkoutReady ? (
            <Button disabled={busy === 'checkout'} onClick={onUpgrade}>
              {copy.billingUpgrade}
            </Button>
          ) : (
            <Button to="/pricing" variant="secondary">
              {copy.viewPlans}
            </Button>
          )
        ) : null}
        {activating ? (
          <Button variant="secondary" onClick={onRefresh}>
            {copy.billingRefresh}
          </Button>
        ) : null}
        {!checkoutReady && (planState === 'trial' || planState === 'free') && !studentProActive ? (
          <Button to="/pricing" variant="ghost">
            {copy.viewPlans}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
