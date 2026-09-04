import { useMemo, useState } from 'react'
import { Check, Sparkles, GraduationCap, ArrowRight, UserRound, Mail, BadgeCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  FLOWLARY_PRICING,
  FREE_DAILY_CREDITS,
  PRO_DAILY_CREDITS,
  formatUsdFromCents,
} from '@flowlary/shared'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import FAQ from '@/bolt/components/ui/FAQ'
import { Reveal } from '../../components/Reveal.tsx'
import { Stagger } from '../../components/Stagger.tsx'
import { useMessages } from '../../i18n/index.tsx'

type BillingPeriod = 'month' | 'year'

function fill(template: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  )
}

export default function Pricing() {
  const t = useMessages()
  const p = t.pages.pricingPage
  const [period, setPeriod] = useState<BillingPeriod>('year')

  const yearly = FLOWLARY_PRICING.yearly.display
  const monthly = FLOWLARY_PRICING.monthly.display
  const yearlyMonthly = formatUsdFromCents(FLOWLARY_PRICING.yearlyEquivalentMonthlyCents)
  const savePercent = useMemo(() => {
    const fullYear = FLOWLARY_PRICING.monthly.amountCents * 12
    if (fullYear <= 0) return 0
    return Math.round((FLOWLARY_PRICING.yearlySavingsCents / fullYear) * 100)
  }, [])
  const saveLabel = fill(p.savePercent, { n: savePercent })
  const yearlySelected = period === 'year'
  const proAmount = yearlySelected ? yearlyMonthly : monthly
  const proCaption = yearlySelected
    ? `${fill(p.billedYearly, { price: yearly })} · ${fill(p.comparedMonthly, { price: monthly })}`
    : p.billedMonthly
  const proHref = `/account?mode=register&interval=${period}`

  return (
    <>
      <PageHeader
        label={t.nav.pricing}
        title={p.title}
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.pricing }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="pr-billing">
            <div className="pr-billing-toggle" role="group" aria-label={p.billingLabel}>
              <button
                type="button"
                className={`pr-billing-btn${period === 'month' ? ' is-on' : ''}`}
                aria-pressed={period === 'month'}
                onClick={() => setPeriod('month')}
              >
                {p.monthlyToggle}
              </button>
              <button
                type="button"
                className={`pr-billing-btn${yearlySelected ? ' is-on' : ''}`}
                aria-pressed={yearlySelected}
                onClick={() => setPeriod('year')}
              >
                {p.yearlyToggle}
                {savePercent > 0 ? <span className="pr-billing-save">{saveLabel}</span> : null}
              </button>
            </div>
          </div>

          <Stagger className="mx-auto grid max-w-5xl items-stretch gap-6 lg:grid-cols-2">
            <div className="pr-plan rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-slate-700 dark:bg-slate-950 sm:p-8 lg:p-10">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{p.free}</h3>
                <p className="mt-1 text-sm text-slate-500">{p.freeLead}</p>
              </div>
              <div className="pr-plan-price">
                <div className="pr-plan-price-row">
                  <span className="pr-plan-amount dark:text-white">$0</span>
                  <span className="pr-plan-cadence">/{t.pages.forever}</span>
                </div>
              </div>
              <ul className="pr-plan-features space-y-3">
                {p.freeItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                    <span>{item.replace('{n}', String(FREE_DAILY_CREDITS))}</span>
                  </li>
                ))}
              </ul>
              <div className="pr-plan-cta">
                <Link to="/guide" className="btn-secondary w-full">
                  {p.installFree}
                </Link>
              </div>
            </div>

            <div className="pr-card is-pro pr-plan relative rounded-2xl border-2 border-sky-400 bg-white p-5 shadow-xl shadow-sky-200/30 dark:bg-slate-950 sm:p-8 lg:p-10">
              <div className="absolute -top-3 end-6 flex items-center gap-1.5 rounded-full bg-sky-500 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3 w-3" />
                {p.recommended}
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{p.pro}</h3>
                <p className="mt-1 text-sm text-slate-500">{p.proLead}</p>
              </div>
              <div className="pr-plan-price">
                <div className="pr-plan-price-row">
                  <span className="pr-plan-amount dark:text-white">{proAmount}</span>
                  <span className="pr-plan-cadence">/{t.pages.month}</span>
                </div>
                <p className="pr-plan-price-caption">{proCaption}</p>
              </div>
              <ul className="pr-plan-features space-y-3">
                {p.proItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                    <span>{item.replace('{n}', String(PRO_DAILY_CREDITS))}</span>
                  </li>
                ))}
              </ul>
              <div className="pr-plan-cta">
                <Link to={proHref} className="btn-primary w-full">
                  {p.tryPro}
                </Link>
                <p className="pr-plan-cta-note">{fill(p.tryProDays, { n: FLOWLARY_PRICING.trialDays })}</p>
              </div>
            </div>
          </Stagger>

          <Reveal className="reveal-d2">
          <div id="pr-compare" className="mx-auto mt-8 max-w-5xl rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-700 dark:bg-slate-950">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{p.compareTitle}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{p.compareLead}</p>
            <p className="mt-2 text-sm text-slate-500">{p.billingNote}</p>
          </div>
          </Reveal>
        </div>
      </section>

      <section id="students" className="border-y border-slate-200 bg-slate-50 fl-section dark:border-slate-700 dark:bg-slate-950">
        <div className="container-flow">
          <Reveal>
            <div className="pr-student-head">
              <p className="pr-student-kicker">
                <GraduationCap className="h-3.5 w-3.5" aria-hidden />
                {p.studentKicker}
              </p>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{p.studentTitle}</h2>
              <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{p.studentLead}</p>
            </div>
          </Reveal>

          <Stagger className="pr-student-steps">
            {p.studentSteps.map((step, index) => {
              const Icon = [UserRound, Mail, BadgeCheck][index] ?? BadgeCheck
              return (
                <article key={step.title} className="pr-student-step">
                  <span className="pr-student-step-index" aria-hidden>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="flex items-center gap-2 dark:text-white">
                      <Icon className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                      {step.title}
                    </h3>
                    <p>{step.body}</p>
                  </div>
                </article>
              )
            })}
          </Stagger>

          <Reveal className="reveal-d2">
            <div className="pr-student-panel">
              <div className="pr-student-col">
                <h3>{p.studentNeedTitle}</h3>
                <ul className="space-y-2.5">
                  {p.studentItems.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-teal-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pr-student-col">
                <h3>{p.studentGetTitle}</h3>
                <ul className="space-y-2.5">
                  {p.studentPerks.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" />
                      <span>{item.replace('{n}', String(PRO_DAILY_CREDITS))}</span>
                    </li>
                  ))}
                </ul>
                <div className="pr-student-actions">
                  <Link to="/account?mode=register&intent=student" className="pr-student-cta">
                    {p.apply}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                  <Link to="#pr-compare" className="btn-secondary w-full">
                    {p.studentSecondary}
                  </Link>
                  <Link to="/contact" className="text-center text-sm font-semibold text-teal-700 hover:text-teal-600 dark:text-teal-400">
                    {p.studentHelp}
                  </Link>
                  <p className="pr-plan-cta-note">{p.studentAccountNote}</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <FAQ items={[...p.faq]} title={p.faqTitle} />
        </div>
      </section>

      <CTASection
        title={p.ctaTitle}
        subtitle={p.ctaLead}
        primaryLabel={t.pages.chrome}
        secondaryLabel={t.pages.compareFeatures}
        secondaryTo="/features"
      />
    </>
  )
}
