import type { Messages } from './en.ts'
import { localeNames } from './buildLocale.ts'

type ShellCopy = {
  tagline: string
  skip: string
  menuOpen: string
  menuClose: string
  locale: string
  theme: string
  features: string
  howItWorks: string
  pricing: string
  account: string
  about: string
  support: string
  guide: string
  blog: string
  privacy: string
  terms: string
  writingLab?: string
  primaryCta: string
  secondaryCta: string
  exploreFeatures: string
  getStarted: string
  viewPricing: string
  product: string
  legal: string
  footerTagline: string
  heroKicker: string
  heroTitle: string
  heroLead: string
  heroNote: string
  heroFacts: [string, string, string, string]
  finalTitle: string
  finalLead: string
}

export function websiteShellOverrides(copy: ShellCopy): Partial<Messages> {
  return {
    brand: { tagline: copy.tagline },
    a11y: {
      skip: copy.skip,
      menuOpen: copy.menuOpen,
      menuClose: copy.menuClose,
      locale: copy.locale,
      theme: copy.theme,
    },
    nav: {
      features: copy.features,
      howItWorks: copy.howItWorks,
      pricing: copy.pricing,
      account: copy.account,
      about: copy.about,
      support: copy.support,
      guide: copy.guide,
      blog: copy.blog,
      privacy: copy.privacy,
      terms: copy.terms,
      ...(copy.writingLab ? { writingLab: copy.writingLab } : {}),
    },
    cta: {
      primary: copy.primaryCta,
      secondary: copy.secondaryCta,
      exploreFeatures: copy.exploreFeatures,
      getStarted: copy.getStarted,
      viewPricing: copy.viewPricing,
    },
    locale: localeNames,
    footer: {
      product: copy.product,
      account: copy.account,
      legal: copy.legal,
      support: copy.support,
      tagline: copy.footerTagline,
    },
    home: {
      heroKicker: copy.heroKicker,
      heroTitle: copy.heroTitle,
      heroLead: copy.heroLead,
      heroNote: copy.heroNote,
      heroFacts: copy.heroFacts,
      finalTitle: copy.finalTitle,
      finalLead: copy.finalLead,
    },
  } as unknown as Partial<Messages>
}
