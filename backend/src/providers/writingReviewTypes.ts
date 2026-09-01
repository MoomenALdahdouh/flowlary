import type { WritingReviewPacket } from '@flowlary/shared'
import type {
  AdvisorProviderErrorCategory,
  AdvisorProviderFailure,
  AdvisorProviderId,
  AdvisorRequestOptions,
  AdvisorTokenUsage,
  ProviderAvailability,
  ProviderHealthSnapshot,
} from './advisorTypes.ts'
import type { WritingReviewEdit, WritingReviewVerdict } from '@flowlary/shared'

export type WritingReviewProviderSuccess = {
  ok: true
  provider: AdvisorProviderId
  model: string
  verdict: WritingReviewVerdict
  ambiguityClass: string
  reasonCode: string
  edits: WritingReviewEdit[]
  latencyMs: number
  usage?: AdvisorTokenUsage
  finishReason?: string
  providerRequestId?: string
}

export type WritingReviewProviderResult = WritingReviewProviderSuccess | AdvisorProviderFailure

type ReviewManagerMetadata = {
  fallbackUsed: boolean
  fallbackReason?: AdvisorProviderErrorCategory
  localDecisionAuthoritative?: boolean
  attempts: Array<{
    provider: AdvisorProviderId
    model: string
    result: 'SUCCESS' | AdvisorProviderErrorCategory
    latencyMs: number
    cooldownMs?: number
    providerRequestId?: string
    finishReason?: string
    usage?: AdvisorTokenUsage
  }>
}

export type WritingReviewManagerResult =
  | (WritingReviewProviderSuccess & ReviewManagerMetadata)
  | (AdvisorProviderFailure & ReviewManagerMetadata)

export interface WritingReviewProvider {
  readonly id: AdvisorProviderId
  readonly model: string
  readonly capabilities: readonly string[]
  readonly enabled: boolean

  reviewWriting(
    packet: WritingReviewPacket,
    options: AdvisorRequestOptions,
  ): Promise<WritingReviewProviderResult>

  health(): ProviderHealthSnapshot
  availability(): ProviderAvailability
}

export type { WritingReviewPacket }
