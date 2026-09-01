import { KEYBOARD_LAYOUTS } from '../../config.ts'
import { CtaBanner, FactGrid, PageHero } from '../../components/Ui.tsx'
import { BrowserStage } from '../../components/product/BrowserStage.tsx'
import { LayoutDemo } from '../../components/Visuals.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function KeyboardLayoutPage() {
  const t = useMessages()
  const c = t.layout
  return (
    <>
      <PageHero kicker={c.kicker} title={c.title} lead={c.lead} />
      <section className="section">
        <div className="container">
          <BrowserStage url={t.demos.browser.wrongLayout}>
            <LayoutDemo />
          </BrowserStage>
          <div className="stack-gap">
            <FactGrid
              items={[
                { title: t.features.what, body: c.what },
                { title: t.features.why, body: c.why },
                { title: t.features.how, body: c.how },
                { title: t.features.mode, body: c.mode },
              ]}
            />
          </div>
        </div>
      </section>
      <section className="band band-problem">
        <div className="container">
          <FactGrid
            items={[
              { title: c.autoTitle, body: c.autoBody },
              { title: c.manualTitle, body: c.manualBody },
              { title: c.mixedTitle, body: c.mixedBody },
              { title: c.speedTitle, body: c.speedBody },
            ]}
          />
          <div className="stack-gap">
            <h2>{c.layoutsTitle}</h2>
            <div className="chip-list">
              {KEYBOARD_LAYOUTS.map((layout) => (
                <span key={layout.id} className="chip">
                  {t.layoutNames[layout.id]}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
      <CtaBanner />
    </>
  )
}
