import { Button, PageHero } from '../components/Ui.tsx'
import { useMessages } from '../i18n/index.tsx'

export function NotFoundPage() {
  const t = useMessages()
  return (
    <>
      <PageHero title={t.notFound.title} lead={t.notFound.lead} />
      <section className="section">
        <div className="container">
          <Button to="/">{t.notFound.home}</Button>
        </div>
      </section>
    </>
  )
}
