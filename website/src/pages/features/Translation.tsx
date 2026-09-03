import { TRANSLATION_LANGUAGES } from '../../config.ts'
import { FeatureDetailShowcase } from '../../components/features/FeatureDetailShowcase.tsx'
import { BrowserStage } from '../../components/product/BrowserStage.tsx'
import { TranslationDemo } from '../../components/demos/ProductDemos.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function TranslationPage() {
  const t = useMessages()
  const c = t.translation
  return (
    <FeatureDetailShowcase
      pageClass="fd-translation"
      kicker={c.kicker}
      title={c.title}
      titleHighlight="in front of you"
      lead={c.lead}
      primaryFacts={[
        { title: t.features.what, body: c.what },
        { title: t.features.why, body: c.why },
        { title: t.features.how, body: c.how },
        { title: t.features.mode, body: c.mode },
      ]}
      demo={
        <BrowserStage url={t.demos.browser.activeTranslate}>
          <TranslationDemo />
        </BrowserStage>
      }
      secondaryTitle={c.languagesTitle}
      secondaryLead={c.languagesBody}
      secondary={
        <>
          <div className="chip-list">
            {TRANSLATION_LANGUAGES.map((lang) => (
              <span key={lang} className="chip">
                {t.languages[lang]}
              </span>
            ))}
          </div>
          <p className="muted">{c.liveNote}</p>
          <div>
            <h3>{c.limitsTitle}</h3>
            <p className="lead">{c.limitsBody}</p>
          </div>
        </>
      }
    />
  )
}
