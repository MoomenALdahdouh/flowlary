import { useEffect, useState } from 'react'
import type { LearningFocus, LearningLevel, LearningProfile } from '@flowlary/shared'
import { LEARNING_FOCUS_AREAS, LEARNING_LEVELS } from '@flowlary/shared'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import {
  dismissLearningSetup,
  fetchLearning,
  patchLearningProfile,
  resetLearningProfile,
  restartLearningOnboarding,
} from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import { ConfirmDialog } from '../../ui/shared.tsx'

type LearningSettingsSectionProps = {
  status: ExtensionStatus
  busy: string | null
  onMutate: (key: string, fn: () => Promise<unknown>) => Promise<void>
  onRestartOnboarding: () => void
  onStatusRefresh: () => Promise<void>
}

export function LearningSettingsSection({
  status,
  busy,
  onMutate,
  onRestartOnboarding,
  onStatusRefresh,
}: LearningSettingsSectionProps) {
  const [profile, setProfile] = useState<LearningProfile | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void fetchLearning()
      .then((response) => {
        if (active) setProfile(response.profile)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [status.learning.onboardingCompleted, status.learning.summary])

  async function updateProfile(patch: Parameters<typeof patchLearningProfile>[0]) {
    await onMutate('learning-profile', async () => {
      const response = await patchLearningProfile(patch)
      setProfile(response.profile)
      await onStatusRefresh()
    })
  }

  function toggleFocus(focus: LearningFocus) {
    if (!profile) return
    const next = profile.focusAreas.includes(focus)
      ? profile.focusAreas.filter((item) => item !== focus)
      : [...profile.focusAreas, focus]
    void updateProfile({ focusAreas: next.length > 0 ? next : profile.focusAreas })
  }

  if (loading || !profile) {
    return <p className="fl-card-desc">{t('connection.checking')}</p>
  }

  return (
    <section className="fl-section">
      <h2 className="fl-section-label">{t('settings.learning')}</h2>
      <div className="fl-settings-block">
        <p className="fl-settings-row">
          <span>{t('learning.learningLanguage')}</span>
          <strong>{t('learning.englishOnly')}</strong>
        </p>

        <p className="fl-settings-row">
          <span>{t('learning.currentLevel')}</span>
          <select
            aria-label={t('learning.currentLevel')}
            value={profile.level ?? ''}
            disabled={busy === 'learning-profile'}
            onChange={(event) => {
              const value = event.target.value
              void updateProfile({ level: value ? (value as LearningLevel) : null })
            }}
          >
            <option value="">{t('learning.levelNotSure')}</option>
            {LEARNING_LEVELS.map((item) => (
              <option key={item} value={item}>
                {t(`learning.level.${item}`)}
              </option>
            ))}
          </select>
        </p>

        <fieldset className="fl-onboarding-field">
          <legend className="fl-onboarding-label">{t('learning.focusAreas')}</legend>
          <div className="fl-onboarding-chips">
            {LEARNING_FOCUS_AREAS.map((focus) => (
              <label key={focus} className="fl-onboarding-chip">
                <input
                  type="checkbox"
                  checked={profile.focusAreas.includes(focus)}
                  disabled={busy === 'learning-profile'}
                  onChange={() => toggleFocus(focus)}
                />
                <span className="fl-onboarding-chip-mark" aria-hidden="true" />
                <span>{t(`learning.focus.${focus}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <p className="fl-settings-row">
          <span>{t('learning.nativeLanguageOptional')}</span>
          <select
            aria-label={t('learning.nativeLanguageOptional')}
            value={profile.nativeLanguage ?? ''}
            disabled={busy === 'learning-profile'}
            onChange={(event) => {
              const value = event.target.value
              void updateProfile({ nativeLanguage: value || null })
            }}
          >
            <option value="">{t('learning.nativeNone')}</option>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </p>

        <p className="fl-settings-row">
          <span>{t('learning.onboardingStatus')}</span>
          <strong>
            {profile.onboardingCompleted ? t('learning.onboardingCompleted') : t('learning.onboardingPending')}
          </strong>
        </p>

        <div className="fl-learning-setup-actions">
          <button
            type="button"
            className="fl-action-btn"
            disabled={busy === 'learning-restart'}
            onClick={() =>
              void onMutate('learning-restart', async () => {
                await restartLearningOnboarding()
                onRestartOnboarding()
              })
            }
          >
            {t('learning.restartSetup')}
          </button>
          <button
            type="button"
            className="fl-action-btn"
            disabled={busy === 'learning-dismiss'}
            onClick={() => void onMutate('learning-dismiss', () => dismissLearningSetup())}
          >
            {t('learning.setupDismiss')}
          </button>
          <button
            type="button"
            className="fl-action-btn"
            disabled={busy === 'learning-reset'}
            onClick={() => setResetOpen(true)}
          >
            {t('learning.resetProfile')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={t('learning.resetConfirmTitle')}
        description={t('learning.resetConfirmDesc')}
        confirmLabel={t('learning.resetConfirmAction')}
        busy={busy === 'learning-reset'}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          void onMutate('learning-reset', async () => {
            const response = await resetLearningProfile()
            setProfile(response.profile)
            await onStatusRefresh()
            setResetOpen(false)
          })
        }}
      />
    </section>
  )
}
