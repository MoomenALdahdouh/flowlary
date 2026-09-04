const DRAFT_KEY = 'flowlary.feedback.draft'

export type FeedbackDraftTab = 'feedback' | 'features' | 'support'

export type FeedbackDraft = {
  tab: FeedbackDraftTab
  rating: number | null
  ratingCategory: string | null
  ratingMessage: string
  feedbackType: string
  feedbackMessage: string
  featureTitle: string
  featureDescription: string
  ticketSubject: string
  ticketMessage: string
  ticketIssueType: string
  includeDiagnostics: boolean
}

export function saveFeedbackDraft(draft: FeedbackDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function readFeedbackDraft(): FeedbackDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeedbackDraft
    if (!parsed || (parsed.tab !== 'feedback' && parsed.tab !== 'features' && parsed.tab !== 'support')) return null
    return parsed
  } catch {
    return null
  }
}

export function clearFeedbackDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}
