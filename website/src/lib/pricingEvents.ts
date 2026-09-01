/** Optional pricing funnel events — no vendor SDK; safe to wire later. Do not send PII. */
export type PricingEventName =
  | 'pricing_view'
  | 'free_cta_click'
  | 'trial_cta_click'
  | 'pro_cta_click'
  | 'student_cta_click'
  | 'student_verification_started'
  | 'student_verification_completed'
  | 'billing_monthly_selected'
  | 'billing_yearly_selected'
  | 'faq_opened'

export function emitPricingEvent(_name: PricingEventName, _detail?: Record<string, string>): void {
  /* no-op until analytics is approved */
}
