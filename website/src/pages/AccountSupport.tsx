import { PageHero } from '../components/Ui.tsx'
import { SupportTicketsPanel } from '../components/support/SupportTicketsPanel.tsx'
import { useMessages } from '../i18n/index.tsx'

export function AccountSupportPage() {
  const t = useMessages()
  const s = t.accountSupport

  return (
    <>
      <PageHero kicker={s.kicker} title={s.pageTitle} lead={s.pageLead} />
      <section className="section">
        <div className="container container-narrow">
          <SupportTicketsPanel />
        </div>
      </section>
    </>
  )
}
