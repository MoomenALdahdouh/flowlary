import { Link } from 'react-router-dom'
import { ArrowRight, Clock } from 'lucide-react'
import PageHeader from '@/bolt/components/ui/PageHeader'
import CTASection from '@/bolt/components/ui/CTASection'
import { BLOG_POSTS } from '@/bolt/data/site'
import { useI18n, useMessages } from '../../../i18n/index.tsx'
import { formatBlogDate } from './formatBlogDate'

const CATEGORY_COLORS: Record<string, string> = {
  keyboard: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  life: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
  philosophy: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  features: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
}

export default function Blog() {
  const t = useMessages()
  const { locale } = useI18n()
  const b = t.pages.blogPage
  const [featured, ...rest] = BLOG_POSTS
  const featuredCopy = b.posts[featured.slug]

  return (
    <>
      <PageHeader
        label={b.label}
        title={b.title}
        subtitle={b.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: t.nav.blog }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <Link
            to={`/blog/${featured.slug}`}
            className="group mb-12 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-lg dark:border-slate-700 dark:bg-slate-950 lg:flex-row"
          >
            <div className="relative min-h-[240px] flex-1 overflow-hidden bg-slate-900 lg:min-h-[320px]">
              <img
                src={featured.cover}
                alt={featuredCopy.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/70 to-transparent p-5 lg:hidden">
                <div className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-sky-200">
                  {b.featured} · {b.categories[featured.category]}
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col justify-center p-8 lg:p-12">
              <div className="mb-3 hidden text-xs font-semibold uppercase tracking-wide text-sky-600 lg:block">
                {b.featured} · {b.categories[featured.category]}
              </div>
              <h2 className="text-balance text-2xl font-bold text-slate-900 dark:text-white lg:text-3xl">{featuredCopy.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{featuredCopy.excerpt}</p>
              <p className="mt-4 text-sm text-slate-500">
                {formatBlogDate(featured.date, locale)} · {b.min.replace('{n}', String(featured.minutes))}
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-sky-600">
                {b.readStory}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
              </div>
            </div>
          </Link>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => {
              const copy = b.posts[post.slug]
              return (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="aspect-[16/9] overflow-hidden bg-slate-900">
                    <img src={post.cover} alt={copy.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className={`mb-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ${CATEGORY_COLORS[post.category]}`}>
                      {b.categories[post.category]}
                    </div>
                    <h3 className="mb-2 text-base font-semibold leading-snug text-slate-900 group-hover:text-sky-600 dark:text-white">{copy.title}</h3>
                    <p className="mb-4 flex-1 text-sm leading-relaxed text-slate-500">{copy.excerpt}</p>
                    <div className="flex items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-800">
                      <span>{formatBlogDate(post.date, locale)}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {b.min.replace('{n}', String(post.minutes))}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      <CTASection title={b.ctaTitle} subtitle={b.ctaLead} secondaryLabel={b.aboutFlowlary} secondaryTo="/about" />
    </>
  )
}
