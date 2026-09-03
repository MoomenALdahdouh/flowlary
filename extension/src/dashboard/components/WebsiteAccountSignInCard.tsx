import { FLOWLARY_SITE_URL } from '../../config/endpoints.ts'
import { openWebsiteAccount } from '../../config/upgrade.ts'
import { t, useI18n } from '../../popup/i18n/index.ts'
import { messageCatalogs } from '../../popup/i18n/resolveMessage.ts'
import { en } from '../../popup/i18n/en.ts'

type WebsiteAccountSignInCardProps = {
  compact?: boolean
}

/**
 * Website-primary auth entry. Account creation, verification, and password reset
 * live on flowlary.com; the content bridge syncs the session into the extension.
 */
export function WebsiteAccountSignInCard({ compact = false }: WebsiteAccountSignInCardProps) {
  const { locale } = useI18n()
  const benefits =
    messageCatalogs[locale].account?.benefits ??
    en.account.benefits

  const siteHost = (() => {
    try {
      return new URL(FLOWLARY_SITE_URL).host
    } catch {
      return 'flowlary.com'
    }
  })()

  if (compact) {
    return (
      <section className="fl-dash-card fl-signin-banner" aria-labelledby="fl-website-signin-title">
        <div className="fl-signin-banner-copy">
          <p className="fl-signin-banner-kicker">{t('account.offerHeadline')}</p>
          <h3 id="fl-website-signin-title" className="fl-signin-banner-title">
            {t('account.websiteSignInTitle')}
          </h3>
          <p className="fl-signin-banner-lead">{t('account.signInHint')}</p>
        </div>
        <button
          type="button"
          className="fl-action-btn fl-action-btn-primary"
          onClick={() => openWebsiteAccount('login')}
        >
          {t('account.websiteSignInCta')}
        </button>
      </section>
    )
  }

  return (
    <div className="fl-account-grid is-single">
      <article className="fl-account-card">
        <div className="fl-account-offer">
          <span className="fl-account-offer-tag">{t('account.offerHeadline')}</span>
          <p>{t('account.offerNote')}</p>
        </div>
        <div className="fl-account-card-head">
          <h3>{t('account.websiteSignInTitle')}</h3>
          <p>{t('account.websiteSignInLead', { site: siteHost })}</p>
        </div>
        <div className="fl-account-callout">
          <strong>{t('account.localMode')}</strong>
          <span>{t('account.localModeDesc')}</span>
        </div>
        <div className="fl-account-benefits">
          <h3>{t('account.benefitsTitle')}</h3>
          <ul className="fl-account-benefits-list">
            {benefits.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <p className="fl-account-hint">{t('account.websiteSignInNote')}</p>
        <div className="fl-account-form-actions fl-account-form-actions-single">
          <button
            type="button"
            className="fl-action-btn fl-action-btn-primary fl-action-btn-wide"
            onClick={() => openWebsiteAccount('login')}
          >
            {t('account.websiteSignInCta')}
          </button>
          <button
            type="button"
            className="fl-action-btn fl-action-btn-wide"
            onClick={() => openWebsiteAccount('register')}
          >
            {t('account.websiteRegisterCta')}
          </button>
        </div>
      </article>
    </div>
  )
}
