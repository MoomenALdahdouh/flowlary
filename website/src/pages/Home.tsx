import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import { HeroSection } from '../components/marketing/HeroSection.tsx'
import { FinalCta } from '../components/marketing/FinalCta.tsx'
import {
  CommunicateSection,
  HowSection,
  LearnSection,
  ProblemSection,
  WhySection,
  WriteSection,
} from '../components/marketing/MarketingHomeSections.tsx'
import { ProductProofSections } from '../components/trust/ProductProofSections.tsx'

const PlaygroundSection = lazy(() =>
  import('../components/playground/PlaygroundSection.tsx').then((module) => ({
    default: module.PlaygroundSection,
  })),
)

const WritingLab = lazy(() =>
  import('../lab/WritingLab.tsx').then((module) => ({
    default: module.WritingLab,
  })),
)

export function HomePage() {
  const { hash } = useLocation()

  // Preserve established deep links without adding either application
  // experience back to the default marketing narrative.
  if (hash === '#writing-lab') {
    return (
      <div className="hp hp-destination">
        <div className="container">
          <Suspense fallback={<div id="writing-lab" aria-busy="true" />}>
            <WritingLab />
          </Suspense>
        </div>
      </div>
    )
  }

  if (hash === '#try-flowlary') {
    return (
      <div className="hp hp-destination">
        <Suspense fallback={<section id="try-flowlary" aria-busy="true" />}>
          <PlaygroundSection />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="hp">
      <HeroSection />
      <ProblemSection />
      <WriteSection />
      <CommunicateSection />
      <LearnSection />
      <ProductProofSections />
      <HowSection />
      <WhySection />
      <FinalCta />
    </div>
  )
}
