import { CtaBanner, FactGrid, PageHero } from '../../components/Ui.tsx'
import { LiveTranslationDemo } from '../../components/demos/ProductDemos.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function LiveTranslationPage() {
  const t = useMessages()
  const c = t.live
  return (
    <>
      <PageHero kicker={c.kicker} title={c.title} lead={c.lead} />
      <section className="section">
        <div className="container split">
          <div className="split-copy">
            <p className="meta-line">{t.live.optionalMeta}</p>
            <FactGrid
              items={[
                { title: t.features.what, body: c.what },
                { title: t.features.why, body: c.why },
                { title: t.features.how, body: c.how },
                { title: t.features.mode, body: c.mode },
              ]}
            />
          </div>
          <LiveTranslationDemo />
        </div>
      </section>
      <section className="band band-problem">
        <div className="container-narrow">
          <h2>{c.cautionTitle}</h2>
          <p className="lead">{c.cautionBody}</p>
        </div>
      </section>
      <CtaBanner />
    </>
  )
}
