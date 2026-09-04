import { useParams, Link } from 'react-router-dom'
import { ArrowRight, Clock, ArrowLeft, ChevronRight } from 'lucide-react'
import { BLOG_POSTS } from '@/bolt/data/site'
import CTASection from '@/bolt/components/ui/CTASection'
import { useI18n, useMessages } from '../../../i18n/index.tsx'
import { formatBlogDate } from './formatBlogDate'

export default function BlogPost() {
  const { slug } = useParams()
  const t = useMessages()
  const { locale } = useI18n()
  const b = t.pages.blogPage
  const post = BLOG_POSTS.find((item) => item.slug === slug)
  const copy = slug ? b.posts[slug as keyof typeof b.posts] : undefined

  if (!post || !copy) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.pages.notFound.title}</h1>
        <Link to="/blog" className="btn-primary">
          {b.label}
        </Link>
      </div>
    )
  }

  const category = b.categories[post.category]

  return (
    <>
      <article>
        <section className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
          <div className="container-flow fl-section">
            <div className="mb-5 flex items-center gap-1.5 text-sm text-slate-500">
              <Link to="/" className="hover:text-sky-600">
                {t.pages.home}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
              <Link to="/blog" className="hover:text-sky-600">
                {t.nav.blog}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180" />
              <span className="text-slate-700 dark:text-slate-300">{category}</span>
            </div>
            <div className="mb-4 inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-600 dark:bg-sky-500/10">{category}</div>
            <h1 className="text-balance text-3xl font-bold leading-tight text-slate-900 dark:text-white sm:text-4xl lg:text-5xl">{copy.title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-400">{copy.excerpt}</p>
            <div className="mt-5 flex items-center gap-4 text-sm text-slate-500">
              <span>{formatBlogDate(post.date, locale)}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {b.min.replace('{n}', String(post.minutes))}
              </span>
            </div>
            <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
              <img src={post.cover} alt={copy.title} className="aspect-[1200/630] w-full object-cover" />
            </div>
          </div>
        </section>

        <section className="fl-section">
          <div className="container-flow">
            <div className="mx-auto max-w-2xl">
              <div className="prose-flow">
                {copy.sections.map((section, index) => (
                  <section key={`${section.heading}-${index}`}>
                    {section.heading ? <h2>{section.heading}</h2> : null}
                    {section.paragraphs.map((para) => (
                      <p key={para}>{para}</p>
                    ))}
                  </section>
                ))}
              </div>

              <div className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
                <Link to="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600">
                  <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                  {b.label}
                </Link>
              </div>

              <div className="mt-12">
                <h3 className="mb-6 text-lg font-bold text-slate-900 dark:text-white">{b.moreStories}</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {BLOG_POSTS.filter((item) => item.slug !== post.slug)
                    .slice(0, 2)
                    .map((item) => {
                      const other = b.posts[item.slug]
                      return (
                        <Link
                          key={item.slug}
                          to={`/blog/${item.slug}`}
                          className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950"
                        >
                          <img src={item.cover} alt={other.title} className="aspect-[16/9] w-full object-cover" />
                          <div className="p-5">
                            <div className="mb-2 text-xs font-medium text-slate-400">{b.categories[item.category]}</div>
                            <h4 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-sky-600 dark:text-white">{other.title}</h4>
                            <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-sky-600">
                              {b.readStory}
                              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 rtl:rotate-180" />
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        </section>
      </article>

      <CTASection title={b.ctaTitle} subtitle={b.ctaLead} secondaryLabel={b.aboutFlowlary} secondaryTo="/about" />
    </>
  )
}
