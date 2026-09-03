import { KEYBOARD_LAYOUTS } from '../../config.ts'
import { FactGrid } from '../../components/Ui.tsx'
import { FeatureDetailShowcase } from '../../components/features/FeatureDetailShowcase.tsx'
import { BrowserStage } from '../../components/product/BrowserStage.tsx'
import { LayoutDemo } from '../../components/Visuals.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function KeyboardLayoutPage() {
  const t = useMessages()
  const c = t.layout
  return (
    <FeatureDetailShowcase
      pageClass="fd-layout"
      kicker={c.kicker}
      title={c.title}
      titleHighlight="wrong layout"
      lead={c.lead}
      demoFirst
      primaryFacts={[
        { title: t.features.what, body: c.what },
        { title: t.features.why, body: c.why },
        { title: t.features.how, body: c.how },
        { title: t.features.mode, body: c.mode },
      ]}
      demo={
        <BrowserStage url={t.demos.browser.wrongLayout}>
          <LayoutDemo />
        </BrowserStage>
      }
      secondaryTitle={c.layoutsTitle}
      secondary={
        <>
          <FactGrid
            items={[
              { title: c.autoTitle, body: c.autoBody },
              { title: c.manualTitle, body: c.manualBody },
              { title: c.mixedTitle, body: c.mixedBody },
              { title: c.speedTitle, body: c.speedBody },
            ]}
          />
          <div className="chip-list">
            {KEYBOARD_LAYOUTS.map((layout) => (
              <span key={layout.id} className="chip">
                {t.layoutNames[layout.id]}
              </span>
            ))}
          </div>
        </>
      }
    />
  )
}
