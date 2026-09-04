import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ChromeIcon } from '../icons/ChromeIcon'
import { Reveal } from '../../../components/Reveal.tsx'
import { useMessages } from '../../../i18n/index.tsx'

export default function CTASection({
  title,
  subtitle,
  primaryTo = '/guide',
  primaryLabel,
  secondaryTo = '/try',
  secondaryLabel,
}: {
  title?: string
  subtitle?: string
  primaryTo?: string
  primaryLabel?: string
  secondaryTo?: string
  secondaryLabel?: string
}) {
  const t = useMessages()
  const resolvedTitle = title ?? t.pages.ctaDefault.title
  const resolvedSubtitle = subtitle ?? t.pages.ctaDefault.subtitle
  const resolvedPrimary = primaryLabel ?? t.pages.chrome
  const resolvedSecondary = secondaryLabel ?? t.pages.tryDemos

  return (
    <section className="cta-ink relative overflow-hidden bg-slate-900">
      <div className="absolute inset-0 bg-grid-dark" />
      <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -bottom-24 -start-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />

      <div className="container-flow relative py-20 text-center sm:py-24 lg:py-32">
        <Reveal variant="scale" className="mx-auto max-w-2xl">
          <h2 className="text-balance text-3xl font-bold text-white sm:text-4xl lg:text-5xl">{resolvedTitle}</h2>
          <p className="mt-5 text-balance text-lg leading-relaxed text-slate-300">{resolvedSubtitle}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={primaryTo}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-7 py-3.5 text-sm font-semibold text-white shadow-xl shadow-sky-500/30 transition-all hover:bg-sky-400 active:scale-[0.97]"
            >
              {primaryTo === '/guide' ? <ChromeIcon className="h-4 w-4" /> : null}
              {resolvedPrimary}
            </Link>
            <Link
              to={secondaryTo}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-500/80 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white transition-all hover:border-sky-400/60 hover:bg-white/10 active:scale-[0.97]"
            >
              {resolvedSecondary}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
