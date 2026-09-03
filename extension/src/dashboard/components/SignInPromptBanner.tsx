import { WebsiteAccountSignInCard } from './WebsiteAccountSignInCard.tsx'

type SignInPromptBannerProps = {
  onOpenAccount?: () => void
}

/** Overview sign-in entry — website-primary auth with optional parent hook. */
export function SignInPromptBanner(_props: SignInPromptBannerProps) {
  return <WebsiteAccountSignInCard compact />
}
