import { PageHero } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'

export function BlogPage() {
  const t = useMessages()
  return (
    <>
      <PageHero kicker={t.blog.kicker} title={t.blog.title} lead={t.blog.lead} />
      <section className="section">
        <div className="container">
          <div className="empty-state">
            <p>{t.blog.empty}</p>
          </div>
        </div>
      </section>
    </>
  )
}
