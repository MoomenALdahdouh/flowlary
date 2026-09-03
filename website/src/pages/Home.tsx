import {
  HomeFinalCta,
  HomeHeroSection,
  HomeKeyboardFixSection,
  HomeLearningSection,
  HomeOneFieldSection,
  HomeProblemSection,
  HomeTwoSurfacesSection,
} from '../components/marketing/HomeExperienceSections.tsx'

export function HomePage() {
  return (
    <div className="hp xp-home">
      <HomeHeroSection />
      <HomeProblemSection />
      <HomeOneFieldSection />
      <HomeKeyboardFixSection />
      <HomeTwoSurfacesSection />
      <HomeLearningSection />
      <HomeFinalCta />
    </div>
  )
}
