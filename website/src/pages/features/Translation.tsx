import { TRANSLATION_LANGUAGES } from '../../config.ts'
import { CtaBanner, FactGrid, PageHero } from '../../components/Ui.tsx'
import { BrowserStage } from '../../components/product/BrowserStage.tsx'
import { TranslationDemo } from '../../components/demos/ProductDemos.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function TranslationPage() {
  const t = useMessages()
  const c = t.translation
  return (
    <>
      <PageHero kicker={c.kicker} title={c.title} lead={c.lead} />
      <section className="section">
        <div className="container split">
          <div className="split-copy">
            <FactGrid
              items={[
                { title: t.features.what, body: c.what },
                { title: t.features.why, body: c.why },
                { title: t.features.how, body: c.how },
                { title: t.features.mode, body: c.mode },
              ]}
            />
          </div>
          <BrowserStage url={t.demos.browser.activeTranslate}>
            <TranslationDemo />
          </BrowserStage>
        </div>
      </section>
      <section className="band band-translate">
        <div className="container">
          <h2>{c.languagesTitle}</h2>
          <p className="lead">{c.languagesBody}</p>
          <div className="chip-list">
            {TRANSLATION_LANGUAGES.map((lang) => (
              <span key={lang} className="chip">
                {t.languages[lang]}
              </span>
            ))}
          </div>
          <p className="muted">{c.liveNote}</p>
          <div className="stack-gap">
            <h2>{c.limitsTitle}</h2>
            <p className="lead">{c.limitsBody}</p>
          </div>
        </div>
      </section>
      <CtaBanner />
    </>
  )
}
