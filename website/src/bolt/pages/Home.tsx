import { Link } from 'react-router-dom'
import {
  Keyboard,
  Languages,
  PenLine,
  ArrowRight,
  Check,
  MousePointerClick,
  Settings,
  Zap,
  Shield,
  ShieldCheck,
  BookOpen,
  TextCursorInput,
} from 'lucide-react'
import { ChromeIcon } from '@/bolt/components/icons/ChromeIcon'
import { SURFACES, FEATURES } from '@/bolt/data/site'
import { FidelityBadge } from '../../components/Ui.tsx'
import CTASection from '@/bolt/components/ui/CTASection'
import KeyboardRepairDemo from '@/bolt/components/demos/KeyboardRepairDemo'
import { CompactJobDemos, InFieldDemo, LiveTranslationDemo, SpeedBoxDemo } from '@/bolt/demos/zipADemos'
import { ProblemExplainDemo, SignatureFieldDemo } from '@/bolt/demos/homePlayDemos.tsx'
import { Reveal } from '../../components/Reveal.tsx'
import { Stagger } from '../../components/Stagger.tsx'
import { useMessages, useI18n } from '../../i18n/index.tsx'
import { useState } from 'react'

const COLOR_MAP: Record<string, string> = {
  sky: 'bg-sky-50 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400',
  teal: 'bg-teal-50 text-teal-500 dark:bg-teal-500/10 dark:text-teal-400',
  amber: 'bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400',
}

const PROBLEM_TONES = ['sky', 'teal', 'navy'] as const

const STAT_ICONS = [TextCursorInput, Languages, ChromeIcon, ShieldCheck]
const STAT_TONES = ['sky', 'teal', 'navy', 'sky'] as const
const LIMIT_ICONS = [PenLine, Shield, BookOpen]
const LIMIT_SIDE_ICONS = [Shield, Settings, Zap, ChromeIcon]
const LIMIT_TONES = ['sky', 'teal', 'navy'] as const
const PROBLEM_ICONS = [Keyboard, PenLine, Languages]
const HOME_SURFACE_IDS = ['extension', 'popup', 'lab', 'dashboard'] as const

export default function Home() {
  const t = useMessages()
  const { locale } = useI18n()
  const p = t.pages.homePage
  const cards = t.pages.cards
  const frustrations = p.problems.map((item, i) => ({ ...item, icon: PROBLEM_ICONS[i] }))
  const [heroJob, setHeroJob] = useState(0)

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="pointer-events-none absolute -top-40 end-0 h-[500px] w-[500px] rounded-full bg-sky-100/40 blur-3xl animate-float dark:bg-sky-500/10" />
        <div className="pointer-events-none absolute top-20 start-0 h-[400px] w-[400px] rounded-full bg-teal-100/30 blur-3xl animate-float dark:bg-teal-500/10" style={{ animationDelay: '1.4s' }} />
        <div className="container-flow relative pt-16 pb-16 sm:pt-24 sm:pb-24 lg:pt-32 lg:pb-28">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div className="hp-hero-copy animate-fade-up">
              <div className="hp-hero-kicker">
                <ChromeIcon className="h-3.5 w-3.5" />
                {p.kicker}
              </div>
              <h1 className="text-balance text-[1.85rem] font-bold leading-[1.08] tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[3.4rem]">
                {p.title}
                <br />
                <span className="text-gradient">{p.titleHighlight}</span>
              </h1>
              <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-slate-600 dark:text-slate-400 sm:mt-5 sm:text-lg">{p.lead}</p>
              {locale === 'ar' ? (
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-500 dark:text-slate-400">{p.altLangTagline}</p>
              ) : null}
              <div className="hp-hero-launch">
                <div className="hp-hero-cta">
                  <Link to="/guide" className="fl-nav-cta h-12 px-6 text-sm">
                    <ChromeIcon className="h-4 w-4" />
                    {t.pages.chrome}
                  </Link>
                  <Link to="/try" className="btn-secondary h-12">
                    {t.pages.tryDemos}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                </div>
                <ul className="hp-hero-jobs">
                  {p.heroJobs.map((job, index) => {
                    const Icon = PROBLEM_ICONS[index] ?? Keyboard
                    const selected = heroJob === index
                    return (
                      <li key={job.label}>
                        <button
                          type="button"
                          className={selected ? 'is-on' : undefined}
                          aria-pressed={selected}
                          onClick={() => setHeroJob(index)}
                        >
                          <span>
                            <Icon aria-hidden="true" />
                            {job.label}
                          </span>
                          <small>{job.hint}</small>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
            <div className="animate-fade-in lg:ps-8">
              <KeyboardRepairDemo job={heroJob} onJobComplete={setHeroJob} />
            </div>
          </div>
        </div>
      </section>

      <section className="hp-proof snow-atmosphere">
        <div className="container-flow fl-section-compact">
          <Stagger className="hp-proof-rail">
            {p.stats.map((stat, index) => {
              const Icon = STAT_ICONS[index] ?? TextCursorInput
              const tone = STAT_TONES[index] ?? 'sky'
              return (
                <article key={stat.label} className="hp-proof-item" data-tone={tone}>
                  <span className="hp-proof-icon" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="hp-proof-copy">
                    <p className="hp-proof-title">{stat.value}</p>
                    <p className="hp-proof-label">{stat.label}</p>
                  </div>
                </article>
              )
            })}
          </Stagger>
        </div>
      </section>

      <section className="hp-explain fl-section">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.problemsKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.problemsTitle}</h2>
            <p className="mt-5 text-balance text-lg text-slate-600 dark:text-slate-400">{p.problemsLead}</p>
          </Reveal>
          <Stagger className="hp-explain-grid fl-section-gap">
            {frustrations.map((f, index) => {
              const Icon = f.icon ?? Keyboard
              const tone = PROBLEM_TONES[index] ?? 'sky'
              return (
                <article key={f.title} className="hp-explain-card" data-tone={tone}>
                  <header className="hp-explain-head">
                    <span className="hp-explain-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="hp-explain-icon">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </header>
                  <h3 className="hp-explain-title">{f.title}</h3>
                  <p className="hp-explain-body">{f.description}</p>
                  <ProblemExplainDemo item={f} join={p.problemsJoin} delayMs={index * 280} />
                </article>
              )
            })}
          </Stagger>
        </div>
      </section>

      <section className="fl-section bg-slate-50 dark:bg-slate-900/40">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.solutionKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.solutionTitle}</h2>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">{p.solutionLead}</p>
          </Reveal>
          <Reveal variant="scale" className="reveal-d2 mx-auto fl-section-gap max-w-3xl">
            <InFieldDemo />
          </Reveal>
        </div>
      </section>

      <section className="hp-sig bg-[#0b1120] fl-section">
        <div className="container-flow">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal variant="start">
              <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-400">
                {p.signatureKicker}
              </span>
              <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl">{p.signatureTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-slate-300">{p.signatureLead}</p>
              <ul className="mt-8 space-y-3">
                {p.signatureItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-300">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/features/keyboard-layout"
                className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-sky-400 hover:text-sky-300"
              >
                {p.signatureCta}
                <ArrowRight className="h-4 w-4 rtl:rotate-180 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal variant="end" className="reveal-d2">
              <SignatureFieldDemo
                beforeLabel={p.signatureBefore}
                beforeNote={p.signatureBeforeNote}
                afterLabel={p.signatureAfter}
                afterNote={p.signatureAfterNote}
                badge={p.signatureBadge}
                scenes={[
                  { typed: p.problems[0].example, fixed: p.problems[0].fixed },
                  { typed: 'hgs hlm', fixed: 'هذا عالم' },
                ]}
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.jobsKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.jobsTitle}</h2>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">{p.jobsLead}</p>
          </Reveal>
          <Reveal variant="scale" className="reveal-d2 fl-section-gap">
            <CompactJobDemos />
          </Reveal>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.featuresKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.featuresTitle}</h2>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">{p.featuresLead}</p>
          </Reveal>
          <Stagger className="fl-section-gap grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const copy = cards[feature.slug]
              return (
                <Link key={feature.slug} to={`/features/${feature.slug}`} className="card card-hover group">
                  <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${COLOR_MAP[feature.color]}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">{copy.tagline}</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{copy.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{copy.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 opacity-0 transition-all group-hover:opacity-100">
                    {t.pages.readMore} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                  </span>
                </Link>
              )
            })}
          </Stagger>
        </div>
      </section>

      <section className="fl-section bg-slate-50 dark:bg-slate-900/40">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.optionalKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.optionalTitle}</h2>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">{p.optionalLead}</p>
          </Reveal>
          <Stagger className="hp-optional-grid fl-section-gap">
            <article className="hp-optional-col">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{p.liveTitle}</h3>
              <p className="hp-optional-lead">{p.liveLead}</p>
              <div className="hp-optional-stage">
                <LiveTranslationDemo />
              </div>
              <Link to="/features/live-translation" className="hp-optional-link">
                {p.liveTitle} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
            <article className="hp-optional-col">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{p.speedTitle}</h3>
              <p className="hp-optional-lead">{p.speedLead}</p>
              <div className="hp-optional-stage">
                <SpeedBoxDemo />
              </div>
              <Link to="/features/speed-box" className="hp-optional-link">
                {p.speedTitle} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          </Stagger>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.whereKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.whereTitle}</h2>
            <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">{p.whereLead}</p>
          </Reveal>
          <Stagger className="fl-section-gap grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SURFACES.filter((surface): surface is (typeof SURFACES)[number] & { id: (typeof HOME_SURFACE_IDS)[number] } =>
              (HOME_SURFACE_IDS as readonly string[]).includes(surface.id),
            ).map((surface) => {
              const copy = t.pages.surfaces[surface.id]
              return (
                <div key={surface.id} className="card card-hover group">
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-all duration-300 group-hover:scale-110 group-hover:bg-sky-500 group-hover:text-white dark:bg-slate-800 dark:text-slate-400">
                    <surface.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{copy.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{copy.job}</p>
                </div>
              )
            })}
          </Stagger>
          <Reveal className="fl-section-gap text-center">
            <Link to="/product" className="group inline-flex items-center gap-2 text-sm font-semibold text-sky-600">
              {t.pages.surfacesFit}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="hp-limits fl-section">
        <div className="container-flow">
          <Reveal variant="clip" className="mx-auto max-w-2xl text-center">
            <span className="section-label">{p.limitsKicker}</span>
            <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.limitsTitle}</h2>
            <p className="mt-5 text-balance text-lg text-slate-600 dark:text-slate-400">{p.limitsLead}</p>
          </Reveal>
          <Stagger className="hp-limits-grid fl-section-gap">
            {p.limits.map((item, i) => {
              const Icon = LIMIT_ICONS[i] ?? Shield
              const tone = LIMIT_TONES[i] ?? 'sky'
              return (
                <article key={item.title} className="hp-limits-card" data-tone={tone}>
                  <span className="hp-limits-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hp-limits-icon">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="hp-limits-card-title">{item.title}</h3>
                  <p className="hp-limits-card-body">{item.desc}</p>
                </article>
              )
            })}
          </Stagger>
          <Reveal className="reveal-d2">
            <aside className="hp-limits-rail" aria-label={p.limitsSideTitle}>
              <p className="hp-limits-rail-kicker">{p.limitsSideTitle}</p>
              <ul>
                {p.limitsSide.map((item, i) => {
                  const Icon = LIMIT_SIDE_ICONS[i] ?? Shield
                  return (
                    <li key={item}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  )
                })}
              </ul>
            </aside>
          </Reveal>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <Reveal variant="start">
              <span className="section-label">{p.tryKicker}</span>
              <h2 className="text-balance text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">{p.tryTitle}</h2>
              <p className="mt-5 text-lg text-slate-600 dark:text-slate-400">{p.tryLead}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <FidelityBadge mode="simulated" />
                <span className="text-sm text-slate-500">{p.simulatedExperience}</span>
                <FidelityBadge mode="live" />
                <span className="text-sm text-slate-500">{p.liveLab}</span>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/try" className="btn-primary">
                  <MousePointerClick className="h-4 w-4" />
                  {t.pages.tryDemos}
                </Link>
                <Link to="/lab" className="btn-secondary">
                  {p.openLab}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
              </div>
            </Reveal>
            <Stagger className="grid gap-4">
              {FEATURES.slice(0, 3).map((feature) => {
                const copy = cards[feature.slug]
                return (
                  <Link
                    key={feature.slug}
                    to={`/features/${feature.slug}`}
                    className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:hover:border-sky-500/50"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${COLOR_MAP[feature.color]}`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{copy.title}</div>
                      <div className="text-xs text-slate-500">{copy.tagline}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 dark:text-slate-600" />
                  </Link>
                )
              })}
            </Stagger>
          </div>
        </div>
      </section>

      <CTASection title={p.ctaTitle} subtitle={p.ctaLead} />
    </>
  )
}
