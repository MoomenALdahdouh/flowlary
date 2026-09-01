import type { ExtensionStatus } from '../../messaging/types.ts'
import { t } from '../../popup/i18n/index.ts'

type LearningSetupCardProps = {
  status: ExtensionStatus
  onSetup: () => void
  onDismiss: () => void
  busy?: boolean
}

export function LearningSetupCard({ status, onSetup, onDismiss, busy }: LearningSetupCardProps) {
  if (
    !status.account.signedIn ||
    status.learning.onboardingCompleted ||
    !status.learning.showSetupPrompt
  ) {
    return null
  }

  return (
    <section className="fl-dash-card fl-learning-setup" aria-labelledby="learning-setup-heading">
      <h3 id="learning-setup-heading" className="fl-section-label">
        {t('learning.setupTitle')}
      </h3>
      <p className="fl-card-desc">{t('learning.setupBody')}</p>
      <div className="fl-learning-setup-actions">
        <button
          type="button"
          className="fl-action-btn fl-action-btn-primary"
          disabled={busy}
          onClick={onSetup}
        >
          {t('learning.setupAction')}
        </button>
        <button type="button" className="fl-action-btn" disabled={busy} onClick={onDismiss}>
          {t('learning.setupDismiss')}
        </button>
      </div>
    </section>
  )
}

type LearningProfileCardProps = {
  status: ExtensionStatus
  onOpenSettings: () => void
}

export function LearningProfileCard({ status, onOpenSettings }: LearningProfileCardProps) {
  if (!status.learning.onboardingCompleted || !status.learning.summary) {
    return null
  }

  return (
    <section className="fl-dash-card fl-learning-profile" aria-labelledby="learning-profile-heading">
      <h3 id="learning-profile-heading" className="fl-section-label">
        {t('learning.profileTitle')}
      </h3>
      <p className="fl-card-desc">{status.learning.summary}</p>
      <button type="button" className="fl-link-btn" onClick={onOpenSettings}>
        {t('learning.editProfile')}
      </button>
    </section>
  )
}
