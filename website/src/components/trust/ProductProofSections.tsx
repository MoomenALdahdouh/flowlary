import { TrustStrip } from './TrustStrip.tsx'
import { SupportedPlatformsSection } from './SupportedPlatformsSection.tsx'
import { UserReviewsSection } from './UserReviewsSection.tsx'
import { BuiltWithUsersSection, FeatureRequestsProof } from './FeatureRequestsProof.tsx'
import { usePublicTrust } from '../../trust/usePublicTrust.ts'

export function ProductProofSections() {
  const { payload } = usePublicTrust()
  if (!payload) {
    return <BuiltWithUsersSection />
  }

  return (
    <>
      <SupportedPlatformsSection platforms={payload.platforms} />
      <TrustStrip stats={payload.stats} />
      <UserReviewsSection testimonials={payload.testimonials} />
      <FeatureRequestsProof items={payload.featureRequests} />
      <BuiltWithUsersSection />
    </>
  )
}
