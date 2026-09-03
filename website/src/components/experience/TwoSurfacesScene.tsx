import { Button } from '../Ui.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ProductScene, WritingField } from './ProductScene.tsx'

/** One continuous product scene: Chrome field + web dashboard (Base44 mass) */
export function TwoSurfacesScene() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.twoSurfaces

  return (
    <div className="xp-two-surfaces xp-two-surfaces-united" dir={direction} lang={locale}>
      <ProductScene url={t.demos.browser.pageUrl} size="hero" glow="cyan">
        <div className="xp-united-grid">
          <div className="xp-united-chrome">
            <span className="xp-surface-badge xp-accent-cyan">{copy.chrome.badge}</span>
            <h3>{copy.chrome.title}</h3>
            <p>{copy.chrome.lead}</p>
            <WritingField
              value="I want send the invoice today."
              dir="ltr"
              lang="en"
              focused
              label={copy.chrome.fieldLabel}
            />
            <div className="xp-chrome-popup">
              <PopupPreview compact animate={false} />
            </div>
          </div>
          <div className="xp-united-web">
            <span className="xp-surface-badge xp-accent-magenta">{copy.web.badge}</span>
            <h3>{copy.web.title}</h3>
            <p>{copy.web.lead}</p>
            <div className="xp-dashboard-mock" aria-hidden="true">
              <aside className="xp-dashboard-rail">
                {copy.web.nav.map((item) => (
                  <span key={item} className={item === copy.web.navActive ? 'is-active' : undefined}>
                    {item}
                  </span>
                ))}
              </aside>
              <div className="xp-dashboard-main">
                <div className="xp-dashboard-stat">
                  <strong>{copy.web.statLabel}</strong>
                  <span>{copy.web.statValue}</span>
                </div>
                <div className="xp-dashboard-bars">
                  <span style={{ height: '72%' }} />
                  <span style={{ height: '48%' }} />
                  <span style={{ height: '86%' }} />
                  <span style={{ height: '54%' }} />
                </div>
                <div className="xp-dashboard-cards">
                  {copy.web.cards.map((card) => (
                    <div key={card.title} className="xp-dashboard-card">
                      <strong>{card.title}</strong>
                      <p>{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <Button variant="link" to="/lab">
              {copy.web.cta}
            </Button>
          </div>
        </div>
      </ProductScene>
    </div>
  )
}

export function LearningLoopScene() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.learningLoop

  return (
    <div className="xp-learning-loop xp-learning-loop-split" dir={direction} lang={locale}>
      <ol className="xp-learning-steps">
        {copy.steps.map((step) => (
          <li key={step.title}>
            <span className="xp-learning-index" aria-hidden="true">
              <svg viewBox="0 0 20 20" className="xp-check">
                <circle cx="10" cy="10" r="9" />
                <path d="M6 10.2 8.6 13 14 7.5" />
              </svg>
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="xp-learning-visual">
        <ProductScene url={t.demos.browser.pageUrl} size="large" glow="magenta">
          <WritingField
            value={
              <>
                I want <mark className="xp-mark-fix">to send</mark> the invoice today.
              </>
            }
            dir="ltr"
            lang="en"
          />
          <div className="xp-learning-practice">
            <strong>{copy.practiceTitle}</strong>
            <p>{copy.practiceBody}</p>
          </div>
        </ProductScene>
      </div>
    </div>
  )
}
