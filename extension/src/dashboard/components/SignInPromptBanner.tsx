import { t } from '../../popup/i18n/index.ts'

type SignInPromptBannerProps = {
  onOpenAccount: () => void
}

/** Single sign-in entry on overview — avoids duplicate cards while signed out. */
export function SignInPromptBanner({ onOpenAccount }: SignInPromptBannerProps) {
  return (
    <section className="fl-dash-card fl-signin-banner" aria-labelledby="fl-signin-banner-title">
      <div className="fl-signin-banner-copy">
        <p className="fl-signin-banner-kicker">{t('account.offerHeadline')}</p>
        <h3 id="fl-signin-banner-title" className="fl-signin-banner-title">
          {t('account.formTitle')}
        </h3>
        <p className="fl-signin-banner-lead">{t('account.signInHint')}</p>
      </div>
      <button type="button" className="fl-action-btn fl-action-btn-primary" onClick={onOpenAccount}>
        {t('account.signIn')}
      </button>
    </section>
  )
}
