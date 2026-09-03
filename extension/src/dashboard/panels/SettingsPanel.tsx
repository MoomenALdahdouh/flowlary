import { useState } from 'react'
import { FREE_DAILY_CREDITS } from '@flowlary/shared'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import { getSupportedLayouts } from '../../features/layout/layouts/registry.ts'
import {
  acceptFlowlaryAi,
  accountLogout,
  patchCorrection,
  patchLayout,
  patchSettings,
  patchTranslation,
  patchWritingPolicy,
} from '../../popup/api.ts'
import { ThemeToggle, ToggleSwitch } from '../../popup/components.tsx'
import { LanguageSwitcher } from '../../popup/components/LanguageSwitcher.tsx'
import { t } from '../../popup/i18n/index.ts'
import { correctionAiLabel } from '../../popup/status.ts'
import { getShortcutLabels } from '../../popup/shortcuts.ts'
import { DataFlowDiagram, InfoCard, ShortcutKey } from '../../ui/shared.tsx'
import { getAccountUrl, openUpgradePage } from '../../config/upgrade.ts'
import { UsageStatusCard } from '../../ui/UsageStatusCard.tsx'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'
import { WebsiteAccountSignInCard } from '../components/WebsiteAccountSignInCard.tsx'
import { LearningSettingsSection } from './LearningSettingsSection.tsx'
import { DataControlSection } from './DataControlSection.tsx'

type SettingsTab = 'writing' | 'languages' | 'learning' | 'data' | 'privacy'

type SettingsPanelProps = {
  status: ExtensionStatus
  busy: string | null
  onMutate: (key: string, fn: () => Promise<unknown>, rollback?: () => void) => Promise<void>
  onStatus: (status: ExtensionStatus) => void
  onRestartOnboarding: () => void
  onReplayTour?: () => void
  onStatusRefresh: () => Promise<ExtensionStatus>
  onOpenActivity: () => void
  onOpenProgress: () => void
}

export function SettingsPanel({
  status,
  busy,
  onMutate,
  onStatus,
  onRestartOnboarding,
  onReplayTour,
  onStatusRefresh,
  onOpenActivity,
  onOpenProgress,
}: SettingsPanelProps) {
  const shortcuts = getShortcutLabels()
  const [tab, setTab] = useState<SettingsTab>('writing')

  return (
    <div className="fl-settings">
      <div className="fl-settings-tabs" role="tablist" aria-label={t('settings.title')}>
        {(
          [
            ['writing', t('settings.writing')],
            ['languages', t('settings.languages')],
            ['learning', t('settings.learning')],
            ['data', t('settings.data')],
            ['privacy', t('settings.privacy')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`fl-settings-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'writing' ? (
      <>
      <section className="fl-section">
        <h2 className="fl-section-label">{t('features.section')}</h2>
        <p className="fl-settings-desc">{t('assistant.lead')}</p>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>{t('assistant.helpStyleLabel')}</span>
            <select
              aria-label={t('assistant.helpStyleLabel')}
              value={status.writingPolicy?.helpStyle ?? 'auto'}
              disabled={busy === 'help-style'}
              onChange={(e) => {
                const next = e.target.value as 'auto' | 'suggestions' | 'shortcuts_only'
                void onMutate('help-style', () => patchWritingPolicy({ helpStyle: next }))
              }}
            >
              <option value="auto">{t('assistant.style.auto')}</option>
              <option value="suggestions">{t('assistant.style.suggestions')}</option>
              <option value="shortcuts_only">{t('assistant.style.shortcuts_only')}</option>
            </select>
          </p>
          <p className="fl-settings-row">
            <span>{t('features.layout')}</span>
            <ToggleSwitch
              id="toggle-policy-layout"
              label={t('features.layout')}
              checked={status.writingPolicy?.fixWrongTyping ?? status.layout.autoEnabled}
              busy={busy === 'policy-layout'}
              onChange={(next) => {
                void onMutate('policy-layout', () => patchWritingPolicy({ fixWrongTyping: next }))
              }}
            />
          </p>
          <p className="fl-settings-row">
            <span>{t('features.correction')}</span>
            <ToggleSwitch
              id="toggle-policy-english"
              label={t('features.correction')}
              checked={status.writingPolicy?.improveEnglish ?? status.correction.enabled}
              busy={busy === 'policy-english'}
              onChange={(next) => {
                void onMutate('policy-english', () => patchWritingPolicy({ improveEnglish: next }))
              }}
            />
          </p>
          <p className="fl-settings-row">
            <span>{t('features.liveTranslation')}</span>
            <ToggleSwitch
              id="toggle-policy-ar-en"
              label={t('features.liveTranslation')}
              checked={status.writingPolicy?.arabicToEnglishMode ?? status.translation.liveEnabled}
              busy={busy === 'policy-ar-en'}
              onChange={(next) => {
                void onMutate('policy-ar-en', () => patchWritingPolicy({ arabicToEnglishMode: next }))
              }}
            />
          </p>
          <p className="fl-settings-row">
            <span>{t('features.aiAdvisor')}</span>
            <ToggleSwitch
              id="toggle-policy-ai"
              label={t('features.aiAdvisor')}
              checked={status.writingPolicy?.aiAdvisorEnabled !== false}
              busy={busy === 'policy-ai'}
              onChange={(next) => {
                void onMutate('policy-ai', () => patchWritingPolicy({ aiAdvisorEnabled: next }))
              }}
            />
          </p>
          <p className="fl-settings-row">
            <span>{t('features.aiWritingReview')}</span>
            <ToggleSwitch
              id="toggle-policy-review"
              label={t('features.aiWritingReview')}
              checked={status.writingPolicy?.aiWritingReviewEnabled !== false}
              busy={busy === 'policy-review'}
              onChange={(next) => {
                void onMutate('policy-review', () => patchWritingPolicy({ aiWritingReviewEnabled: next }))
              }}
            />
          </p>
          <p className="fl-settings-row">
            <span>{t('settings.polishAfterTranslate')}</span>
            <ToggleSwitch
              id="toggle-polish"
              label={t('settings.polishAfterTranslate')}
              checked={status.writingPolicy?.polishAfterTranslate === true}
              busy={busy === 'policy-polish'}
              onChange={(next) => {
                void onMutate('policy-polish', () => patchWritingPolicy({ polishAfterTranslate: next }))
              }}
            />
          </p>
          <label className="fl-settings-desc" htmlFor="excluded-hosts">
            {t('settings.excludedSites')}
          </label>
          <textarea
            id="excluded-hosts"
            className="fl-settings-textarea"
            rows={3}
            defaultValue={(status.excludedDomains ?? []).join('\n')}
            placeholder={t('settings.excludedSitesHint')}
            onBlur={(event) => {
              const excludedDomains = event.target.value
                .split(/[\n,]/)
                .map((item) => item.trim())
                .filter(Boolean)
              void onMutate('excluded', () => patchSettings({ excludedDomains }))
            }}
          />
          <p className="fl-settings-desc">{t('settings.excludedSitesHint')}</p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.appearance')}</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>{t('settings.uiLanguage')}</span>
            <LanguageSwitcher />
          </p>
          <p className="fl-settings-row">
            <span>{t('settings.theme')}</span>
            <ThemeToggle />
          </p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.writing')}</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-desc">{t('settings.modeHint')}</p>
          <p className="fl-settings-row">
            <span>{t('settings.highlights')}</span>
            <ToggleSwitch
              id="toggle-highlights"
              label={t('settings.highlights')}
              checked={status.correction.highlights}
              busy={busy === 'highlights'}
              onChange={(next) => {
                const prev = status.correction.highlights
                onStatus({ ...status, correction: { ...status.correction, highlights: next } })
                void onMutate(
                  'highlights',
                  () => patchCorrection({ highlights: next }),
                  () => onStatus({ ...status, correction: { ...status.correction, highlights: prev } }),
                )
              }}
            />
          </p>
          <p className="fl-settings-desc">{t('settings.highlightsHint')}</p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.aiSection')}</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-desc">{t('settings.aiHint')}</p>
          <p className="fl-inline-meta">
            <span>{t('settings.writingAi')}</span>
            <strong>
              {correctionAiLabel({
                aiReady: status.correction.aiReady,
                consentAccepted: status.correction.consentAccepted,
              })}
            </strong>
          </p>
          {!status.correction.consentAccepted ? (
            <button
              type="button"
              className="fl-action-btn fl-action-btn-primary"
              disabled={busy === 'consent'}
              onClick={() => void onMutate('consent', () => acceptFlowlaryAi())}
            >
              {t('ai.enable')}
            </button>
          ) : null}
        </div>
      </section>
      </>
      ) : null}

      {tab === 'languages' ? (
      <>
      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.translation')}</h2>
        <div className="fl-settings-block">
          {status.writingPolicy?.helpStyle === 'auto' || status.translation.mode === 'direct' ? (
            <p className="fl-settings-row">
              <span>{t('features.liveTranslation')}</span>
              <ToggleSwitch
                id="toggle-live-dashboard"
                label={t('features.liveTranslation')}
                checked={status.writingPolicy?.arabicToEnglishMode ?? status.translation.liveEnabled}
                busy={busy === 'live'}
                onChange={(next) => {
                  void onMutate('live', () => patchWritingPolicy({ arabicToEnglishMode: next }))
                }}
              />
            </p>
          ) : null}
          <p className="fl-settings-row">
            <span>{t('settings.source')}</span>
            <select
              aria-label={t('settings.source')}
              value={status.translation.sourceLanguage}
              disabled={busy === 'source-lang'}
              onChange={(e) => {
                const next = e.target.value
                const prev = status.translation.sourceLanguage
                void onMutate(
                  'source-lang',
                  () => patchTranslation({ sourceLanguage: next }),
                  () =>
                    onStatus({
                      ...status,
                      translation: { ...status.translation, sourceLanguage: prev },
                    }),
                )
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </p>
          <p className="fl-settings-row">
            <span>{t('settings.target')}</span>
            <select
              aria-label={t('settings.target')}
              value={status.translation.targetLanguage}
              disabled={busy === 'target-lang'}
              onChange={(e) => {
                const next = e.target.value
                const prev = status.translation.targetLanguage
                void onMutate(
                  'target-lang',
                  () => patchTranslation({ targetLanguage: next }),
                  () =>
                    onStatus({
                      ...status,
                      translation: { ...status.translation, targetLanguage: prev },
                    }),
                )
              }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.layout')}</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>{t('settings.speedBox')}</span>
            <ToggleSwitch
              id="toggle-speed-box"
              label={t('settings.speedBox')}
              checked={status.layout.manualConversionEnabled}
              busy={busy === 'speed-box'}
              onChange={(next) => {
                const prev = status.layout.manualConversionEnabled
                onStatus({ ...status, layout: { ...status.layout, manualConversionEnabled: next } })
                void onMutate(
                  'speed-box',
                  () => patchLayout({ manualConversionEnabled: next }),
                  () =>
                    onStatus({
                      ...status,
                      layout: { ...status.layout, manualConversionEnabled: prev },
                    }),
                )
              }}
            />
          </p>
          <p className="fl-settings-desc">{t('settings.speedBoxHint')}</p>
          <p className="fl-settings-row">
            <span>{t('settings.manualShortcut')}</span>
            <ToggleSwitch
              id="toggle-layout-shortcut"
              label={t('settings.manualShortcut')}
              checked={status.layout.directShortcutEnabled}
              busy={busy === 'layout-shortcut'}
              onChange={(next) => {
                const prev = status.layout.directShortcutEnabled
                onStatus({ ...status, layout: { ...status.layout, directShortcutEnabled: next } })
                void onMutate(
                  'layout-shortcut',
                  () => patchLayout({ directShortcutEnabled: next }),
                  () =>
                    onStatus({
                      ...status,
                      layout: { ...status.layout, directShortcutEnabled: prev },
                    }),
                )
              }}
            />
          </p>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.layoutKeyboard')}</h2>
        <div className="fl-settings-block">
          <p className="fl-settings-row">
            <span>{t('settings.layoutSource')}</span>
            <select
              aria-label={t('settings.layoutSource')}
              value={status.layout.sourceLayout}
              disabled={busy === 'layout-source'}
              onChange={(e) => {
                const next = e.target.value
                const prev = status.layout.sourceLayout
                onStatus({ ...status, layout: { ...status.layout, sourceLayout: next } })
                void onMutate(
                  'layout-source',
                  () => patchLayout({ sourceLayout: next }),
                  () => onStatus({ ...status, layout: { ...status.layout, sourceLayout: prev } }),
                )
              }}
            >
              {getSupportedLayouts().map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name}
                </option>
              ))}
            </select>
          </p>
          <fieldset className="fl-settings-fieldset">
            <legend>{t('settings.layoutTargets')}</legend>
            {getSupportedLayouts().map((layout) => {
              const checked = status.layout.targetLayouts.includes(layout.id)
              return (
                <label key={layout.id} className="fl-settings-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy === 'layout-targets'}
                    onChange={() => {
                      const nextTargets = checked
                        ? status.layout.targetLayouts.filter((id) => id !== layout.id)
                        : [...status.layout.targetLayouts, layout.id]
                      const ensured =
                        nextTargets.length > 0 ? nextTargets : [status.layout.sourceLayout]
                      const prev = status.layout.targetLayouts
                      onStatus({
                        ...status,
                        layout: { ...status.layout, targetLayouts: ensured },
                      })
                      void onMutate(
                        'layout-targets',
                        () => patchLayout({ targetLayouts: ensured }),
                        () =>
                          onStatus({
                            ...status,
                            layout: { ...status.layout, targetLayouts: prev },
                          }),
                      )
                    }}
                  />
                  <span>{layout.name}</span>
                </label>
              )
            })}
          </fieldset>
        </div>
      </section>

      <section className="fl-section">
        <h2 className="fl-section-label">{t('settings.shortcuts')}</h2>
        <div className="fl-settings-block">
          <ul className="fl-shortcut-list">
            <li>
              <span>{t('shortcuts.translate')}</span>
              <ShortcutKey label={shortcuts.translate} />
            </li>
            <li>
              <span>{t('shortcuts.fixLayout')}</span>
              <ShortcutKey label={shortcuts.fixLayout} />
            </li>
            <li>
              <span>{t('shortcuts.speedBox')}</span>
              <ShortcutKey label={shortcuts.speedBox} />
            </li>
          </ul>
        </div>
      </section>
      </>
      ) : null}

      {tab === 'learning' ? (
      <LearningSettingsSection
        status={status}
        busy={busy}
        onMutate={onMutate}
        onRestartOnboarding={onRestartOnboarding}
        onStatusRefresh={onStatusRefresh}
      />
      ) : null}

      {tab === 'data' ? (
        <DataControlSection
          status={status}
          busy={busy}
          onMutate={onMutate}
          onOpenActivity={onOpenActivity}
          onOpenProgress={onOpenProgress}
          onRestartOnboarding={onRestartOnboarding}
          onStatusRefresh={onStatusRefresh}
          onStatus={onStatus}
        />
      ) : null}

      {tab === 'privacy' ? <PrivacyPanel embedded /> : null}

      {tab === 'writing' ? (
        <p className="fl-overview-links">
          {onReplayTour ? (
            <button type="button" className="fl-link-btn" onClick={onReplayTour}>
              {t('dashboard.replayTour')}
            </button>
          ) : null}
          <a href={`${FLOWLARY_SITE_URL}/guide`} target="_blank" rel="noreferrer">
            {t('dashboard.tutorial')}
          </a>
        </p>
      ) : null}
    </div>
  )
}

type AccountPanelProps = {
  status: ExtensionStatus
  busy: string | null
  onMutate: (key: string, fn: () => Promise<ExtensionStatus>) => Promise<void>
}

export function AccountPanel({ status, busy, onMutate }: AccountPanelProps) {
  const usage = resolveUsageUxFromStatus(status)

  function openAccountSite() {
    const url = getAccountUrl()
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) void chrome.tabs.create({ url })
    else window.open(url, '_blank', 'noopener')
  }

  return (
    <div className={`fl-account-page${status.account.signedIn ? '' : ' is-signed-out'}`}>
      <header className="fl-dash-heading">
        <h2 className="visually-hidden">{t('account.title')}</h2>
      </header>

      {status.account.signedIn ? (
        <div className="fl-account-signed-in">
          <div className="fl-account-identity">
            <span className="fl-account-badge">{t('account.signedIn')}</span>
            <p className="fl-account-email">{status.account.email}</p>
          </div>

          <div className="fl-dash-card fl-account-usage">
            <UsageStatusCard view={usage} />
          </div>

          <div className="fl-account-stats">
            <article className="fl-account-stat">
              <p className="fl-account-stat-label">{t('account.serverPlan')}</p>
              <p className="fl-account-stat-value">
                {status.entitlement.isPro ? 'Pro' : (status.account.serverPlan ?? 'Free')}
              </p>
            </article>
            <article className="fl-account-stat">
              <p className="fl-account-stat-label">{t('account.usage')}</p>
              <p className="fl-account-stat-value">
                {status.account.signedIn
                  ? `${Math.max(0, status.entitlement.creditsRemaining)} / ${status.entitlement.dailyLimit || FREE_DAILY_CREDITS}`
                  : t('usage.unavailable')}
              </p>
            </article>
            <article className="fl-account-stat">
              <p className="fl-account-stat-label">{t('account.subscription')}</p>
              <p className="fl-account-stat-value fl-account-stat-value-sm">
                {status.account.subscriptionStatus ?? t('account.billingUnavailable')}
              </p>
            </article>
          </div>

          {status.account.paymentFailed ? <p className="fl-account-note is-warn">{t('account.paymentIssue')}</p> : null}
          {status.account.cancelAtPeriodEnd ? (
            <p className="fl-account-note">{t('account.cancelScheduled')}</p>
          ) : null}

          <div className="fl-account-actions">
            <button
              type="button"
              className="fl-action-btn fl-action-btn-wide fl-action-btn-primary"
              onClick={() => {
                if (status.entitlement.isPro) openAccountSite()
                else if (status.account.billingAvailable) openUpgradePage()
                else openAccountSite()
              }}
            >
              {status.entitlement.isPro
                ? t('account.manageSubscription')
                : status.account.billingAvailable
                  ? t('account.upgradeToPro')
                  : t('account.openWebsite')}
            </button>
            {!status.account.billingAvailable && !status.entitlement.isPro ? (
              <p className="fl-account-note">{t('account.billingUnavailableHint')}</p>
            ) : null}
            <button
              type="button"
              className="fl-action-btn fl-action-btn-wide"
              disabled={busy === 'account-logout'}
              onClick={() => void onMutate('account-logout', () => accountLogout())}
            >
              {t('account.signOut')}
            </button>
          </div>
        </div>
      ) : (
        <WebsiteAccountSignInCard />
      )}
    </div>
  )
}

export function PrivacyPanel({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className="fl-privacy-page">
      {!embedded ? (
        <>
          <h2 className="fl-dash-page-title">{t('settings.privacy')}</h2>
          <p className="fl-dash-lead">{t('dashboard.privacyLead')}</p>
        </>
      ) : null}

      <div className="fl-dash-card">
        <DataFlowDiagram />
      </div>

      <div className="fl-privacy-grid">
        <InfoCard title={t('privacy.atAGlanceTitle')}>
          <p>{t('privacy.atAGlanceBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.localTitle')}>
          <p>{t('privacy.localBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.leavesTitle')}>
          <p>{t('privacy.leavesBody')}</p>
          <ul className="fl-privacy-list">
            <li>{t('privacy.leavesAi')}</li>
            <li>{t('privacy.leavesClassification')}</li>
          </ul>
        </InfoCard>
        <InfoCard title={t('privacy.aiReceivesTitle')}>
          <p>{t('privacy.aiReceivesBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.notStoredTitle')}>
          <p>{t('privacy.notStoredBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.neverTitle')}>
          <p>{t('privacy.neverBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.activityTitle')}>
          <p>{t('privacy.activityBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.learningTitle')}>
          <p>{t('privacy.learningBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.learningEventsTitle')}>
          <p>{t('privacy.learningEventsBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.practiceTitle')}>
          <p>{t('privacy.practiceBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.accountTitle')}>
          <p>{t('privacy.accountBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.analyticsTitle')}>
          <p>{t('privacy.analyticsBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.controlsTitle')}>
          <p>{t('privacy.controlsBody')}</p>
        </InfoCard>
        <InfoCard title={t('privacy.accountDeleteTitle')}>
          <p>{t('privacy.accountDeleteBody')}</p>
        </InfoCard>
      </div>
    </div>
  )
}
