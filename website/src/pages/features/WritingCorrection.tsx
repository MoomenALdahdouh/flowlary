import { FactGrid } from '../../components/Ui.tsx'
import { FeatureDetailShowcase } from '../../components/features/FeatureDetailShowcase.tsx'
import { BrowserStage } from '../../components/product/BrowserStage.tsx'
import { CorrectionDemo } from '../../components/demos/ProductDemos.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function WritingCorrectionPage() {
  const t = useMessages()
  const c = t.correction
  return (
    <FeatureDetailShowcase
      pageClass="fd-correction"
      kicker={c.kicker}
      title={c.title}
      titleHighlight="on the page"
      lead={c.lead}
      metaLine={c.metaLine}
      primaryFacts={[
        { title: t.features.what, body: c.what },
        { title: t.features.why, body: c.why },
        { title: t.features.how, body: c.how },
        { title: t.features.mode, body: c.mode },
      ]}
      demo={
        <BrowserStage url={t.demos.browser.activeCorrection}>
          <CorrectionDemo />
        </BrowserStage>
      }
      secondary={
        <FactGrid
          items={[
            { title: c.focusTitle, body: c.focusBody },
            { title: c.controlTitle, body: c.controlBody },
            { title: c.safetyTitle, body: c.safetyBody },
            { title: c.aiTitle, body: c.aiBody },
          ]}
        />
      }
    />
  )
}
