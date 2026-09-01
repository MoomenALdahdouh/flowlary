import { SHORTCUTS } from '../../config.ts'
import { CtaBanner, FactGrid, PageHero } from '../../components/Ui.tsx'
import { SpeedBoxMock } from '../../components/Visuals.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function SpeedBoxPage() {
  const t = useMessages()
  const c = t.speedBox
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
                {
                  title: t.features.mode,
                  body: (
                    <>
                      {c.mode} <kbd>{SHORTCUTS.speedBox.other}</kbd> / <kbd>{SHORTCUTS.speedBox.mac}</kbd>
                    </>
                  ),
                },
              ]}
            />
          </div>
          <SpeedBoxMock />
        </div>
      </section>
      <section className="band band-problem">
        <div className="container-narrow">
          <h2>{c.notTitle}</h2>
          <p className="lead">{c.notBody}</p>
        </div>
      </section>
      <CtaBanner />
    </>
  )
}
