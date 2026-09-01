/** Trust visibility for a public proof element. */
export type TrustMetricState = 'AVAILABLE' | 'INSUFFICIENT_DATA' | 'DISABLED'

export type VerifiedExternalStat = {
  source: 'chrome_web_store' | 'edge_addons' | 'manual'
  value: number
  verifiedAt: number
  label: string
}

/** Minimum sample sizes before surfacing aggregate proof publicly. */
export const PRODUCT_STATISTICS_THRESHOLDS = {
  /** Minimum internal ratings before showing an average publicly. */
  minInternalRatings: 10,
  /** Minimum approved testimonials before rendering the reviews section. */
  minPublishedTestimonials: 3,
  /** Minimum votes before showing a feature request in public social proof. */
  minFeatureRequestVotes: 1,
  /** Minimum registered users before showing count (still real when shown). */
  minRegisteredUsers: 1,
} as const

export type PublicProductStatKey =
  | 'registeredUsers'
  | 'activeUsersLast30Days'
  | 'writingChecks'
  | 'corrections'
  | 'translations'
  | 'linkedInstalls'
  | 'averageInternalRating'
  | 'internalRatingCount'
  | 'chromeRating'
  | 'chromeReviewCount'
  | 'edgeRating'
  | 'edgeReviewCount'

export type PublicProductStatsView = {
  generatedAt: number
  cacheTtlSeconds: number
  metrics: Partial<Record<PublicProductStatKey, number>>
  metricStates: Partial<Record<PublicProductStatKey, TrustMetricState>>
  /** Present only when real internal rating qualifies. */
  internalRating?: { average: number; count: number; source: 'flowlary_users' }
  /** Present only when externally verified store stats exist. */
  storeRatings?: {
    chrome?: { rating: number; reviewCount: number; source: 'chrome_web_store' }
    edge?: { rating: number; reviewCount: number; source: 'edge_addons' }
  }
}

export type PublicFeatureRequestStat = {
  id: string
  title: string
  voteCount: number
  status: string
  roadmapBucket: 'now' | 'next' | 'exploring' | 'shipped' | null
}

export type PublicTestimonialView = {
  id: string
  displayName: string
  role: string | null
  country: string | null
  quote: string
  feature: string | null
}

export type PublicTrustPayload = {
  stats: PublicProductStatsView
  platforms: ReturnType<typeof import('./platforms.ts').listPublicSupportedPlatforms>
  featureRequests: PublicFeatureRequestStat[]
  testimonials: PublicTestimonialView[]
  roadmap: PublicFeatureRequestStat[]
}

export type AccountPersonalStatsView = {
  writingChecksUsed: number
  corrections: number
  translations: number
  layoutChecks: number
  learningEvents: number
  practiceSessions: number
  activeDays: number
  meaningfulUseCount: number
  firstWinCompleted: boolean
  creditsUsedToday: number
  creditsRemainingToday: number | null
}

export type GrowthAdminSummaryView = {
  acquisition: {
    registeredUsers: number
    verifiedEmails: number
    linkedInstalls: number
    trialAccounts: number
    studentApplications: number
    studentActive: number
  }
  activation: {
    firstWinCompleted: number
    meaningfulUseAccounts: number
    notInstrumented: string[]
  }
  engagement: {
    activeUsersLast7Days: number
    activeUsersLast30Days: number
    writingChecksTotal: number
    writingChecksLast30Days: number
  }
  retention: {
    notInstrumented: string[]
  }
  monetization: {
    proSubscriptions: number
    trialToProNotInstrumented: boolean
    mrrCents: number | null
  }
  feedback: {
    totalFeedback: number
    averageInternalRating: number | null
    internalRatingCount: number
    featureRequests: number
  }
  funnel: {
    registeredUsers: number
    linkedInstalls: number
    firstWinCompleted: number
    meaningfulUseAccounts: number
    trialAccounts: number
    proAccounts: number
    stagesNotInstrumented: string[]
  }
}

export type TestimonialConsentChoice = 'yes' | 'no'
export type TestimonialDisplayPreference = 'full_name' | 'first_initial' | 'anonymous'

export type TestimonialRecord = {
  id: string
  feedbackId: string
  accountId: string
  displayName: string
  role: string | null
  country: string | null
  originalQuote: string
  displayQuote: string
  feature: string | null
  consentGiven: boolean
  displayPreference: TestimonialDisplayPreference
  approvedAt: number | null
  published: boolean
  createdAt: number
  updatedAt: number
}
