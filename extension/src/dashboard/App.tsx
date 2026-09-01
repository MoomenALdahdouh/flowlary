import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND, type LearningProfile } from '@flowlary/shared'
import {
  dismissLearningSetup,
  fetchLearning,
  fetchStatus,
  restartLearningOnboarding,
} from '../popup/api.ts'
import { AccountAvatar, PopupLogo, ThemeToggle } from '../popup/components.tsx'
import { t } from '../popup/i18n/index.ts'
import { type DashboardSection } from '../config/dashboard.ts'
import { useExtensionSession } from '../popup/useExtensionSession.ts'
import { useFeatureMutations } from '../ui/useFeatureMutations.ts'
import { HeaderStatusPill } from '../ui/SystemStatus.tsx'
import { DashboardPage } from './DashboardPage.tsx'
import { DashboardTour } from './onboarding/DashboardTour.tsx'
import { OnboardingFlow } from './onboarding/OnboardingFlow.tsx'
import {
  loadDashboardTourState,
  markDashboardTourPending,
  resetDashboardTour,
} from './onboarding/tourStorage.ts'
import { LearningReportPanel } from './panels/LearningReportPanel.tsx'
import { OverviewPanel } from './panels/OverviewPanel.tsx'
import { PracticeSection } from './panels/PracticeSection.tsx'
import { ProgressPanel } from './panels/ProgressPanel.tsx'
import { HistoryPanel } from './panels/HistoryPanel.tsx'
import { AccountPanel, SettingsPanel } from './panels/SettingsPanel.tsx'

const NAV_GROUPS: { labelKey: 'navHome' | 'navManage'; items: { id: DashboardSection; label: string }[] }[] = [
  {
    labelKey: 'navHome',
    items: [
      { id: 'overview', label: t('nav.home') },
      { id: 'practice', label: t('nav.practice') },
      { id: 'progress', label: t('nav.progress') },
      { id: 'report', label: t('nav.report') },
    ],
  },
  {
    labelKey: 'navManage',
    items: [
      { id: 'settings', label: t('settings.title') },
      { id: 'account', label: t('account.title') },
    ],
  },
]

function parseSection(hash: string): DashboardSection {
  const id = hash.replace(/^#/, '').split('?')[0] ?? ''
  if (id === 'history') return 'activity'
  if (id === 'byok' || id === 'ai' || id === 'writing' || id === 'privacy') return 'settings'
  if (
    id === 'overview' ||
    id === 'progress' ||
    id === 'practice' ||
    id === 'report' ||
    id === 'settings' ||
    id === 'activity' ||
    id === 'account'
  ) {
    return id
  }
  return 'overview'
}

function parsePracticeTargetFromHash(hash: string): string | undefined {
  const raw = hash.replace(/^#/, '')
  const query = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : ''
  if (!query) return undefined
  const target = new URLSearchParams(query).get('target')?.trim()
  return target || undefined
}

export function DashboardApp() {
  const session = useExtensionSession()
  const { status, loading, busy, error, domain, mutate } = session
  const mutations = useFeatureMutations(session)
  const [section, setSection] = useState<DashboardSection>(() =>
    typeof window === 'undefined' ? 'overview' : parseSection(window.location.hash),
  )
  const [practiceTargetId, setPracticeTargetId] = useState<string | undefined>(() =>
    typeof window === 'undefined' ? undefined : parsePracticeTargetFromHash(window.location.hash),
  )
  const [learningProfile, setLearningProfile] = useState<LearningProfile | null>(null)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [onboardingBusy, setOnboardingBusy] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const onboardingClosingRef = useRef(false)

  useEffect(() => {
    if (!status) return
    if (onboardingClosingRef.current) {
      if (status.learning.onboardingCompleted) {
        onboardingClosingRef.current = false
      }
      setOnboardingOpen(false)
      return
    }
    if (!status.account.signedIn) {
      setOnboardingOpen(false)
      return
    }
    const fw = status.firstWin ?? { completed: true, localSuccess: false, aiSuccess: false }
    const hasFirstSuccess = fw.completed || fw.localSuccess || fw.aiSuccess
    const shouldOpen =
      hasFirstSuccess &&
      !status.learning.onboardingCompleted &&
      (status.learning.showFullOnboarding || status.learning.onboardingStep != null)
    setOnboardingOpen(shouldOpen)
  }, [status])

  useEffect(() => {
    if (!onboardingOpen || learningProfile) return
    void fetchLearning().then((response) => setLearningProfile(response.profile))
  }, [onboardingOpen, learningProfile])

  useEffect(() => {
    if (!status?.account.signedIn || !status.learning.onboardingCompleted || onboardingOpen) {
      setTourOpen(false)
      return
    }
    let cancelled = false
    void loadDashboardTourState().then((tour) => {
      if (!cancelled && tour.pending && !tour.completed) setTourOpen(true)
    })
    return () => {
      cancelled = true
    }
  }, [status?.account.signedIn, status?.learning.onboardingCompleted, onboardingOpen])

  async function refreshStatus() {
    const next = await fetchStatus()
    session.setStatus(next)
    return next
  }

  async function beginLearningSetup() {
    onboardingClosingRef.current = false
    setOnboardingBusy(true)
    try {
      const response = await restartLearningOnboarding()
      setLearningProfile(response.profile)
      setOnboardingOpen(true)
      await refreshStatus()
    } finally {
      setOnboardingBusy(false)
    }
  }

  async function dismissLearningSetupPrompt() {
    await dismissLearningSetup()
    await refreshStatus()
  }

  async function finishOnboarding(completedProfile?: LearningProfile) {
    onboardingClosingRef.current = true
    setOnboardingOpen(false)
    if (completedProfile) {
      setLearningProfile(completedProfile)
      if (status) {
        session.setStatus({
          ...status,
          learning: {
            ...status.learning,
            onboardingCompleted: true,
            showFullOnboarding: false,
            showSetupPrompt: false,
            onboardingStep: null,
            summary: completedProfile
              ? [
                  completedProfile.learningLanguage === 'en'
                    ? 'English'
                    : completedProfile.learningLanguage.toUpperCase(),
                  completedProfile.level?.replace(/_/g, ' '),
                  completedProfile.focusAreas
                    .map((area) => area.charAt(0).toUpperCase() + area.slice(1))
                    .join(' + ') || undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : status.learning.summary,
          },
        })
      }
    }
    await markDashboardTourPending()
    try {
      await refreshStatus()
    } finally {
      onboardingClosingRef.current = false
    }
    go('overview')
  }

  async function startDashboardTour() {
    await resetDashboardTour()
    go('overview')
    setTourOpen(true)
  }

  useEffect(() => {
    function onHash() {
      setSection(parseSection(window.location.hash))
      setPracticeTargetId(parsePracticeTargetFromHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = useCallback((next: DashboardSection, options?: { practiceTarget?: string }) => {
    setSection(next)
    if (next === 'practice' && options?.practiceTarget?.trim()) {
      setPracticeTargetId(options.practiceTarget.trim())
    } else if (next !== 'practice') {
      setPracticeTargetId(undefined)
    }
    let hash = next === 'overview' ? 'overview' : next
    if (next === 'practice' && options?.practiceTarget?.trim()) {
      hash = `practice?target=${encodeURIComponent(options.practiceTarget.trim())}`
    }
    const nextHash = `#${hash}`
    if (window.location.hash !== nextHash) {
      window.location.hash = hash
    }
  }, [])

  const pageTitle =
    section === 'overview'
      ? t('nav.home')
      : section === 'progress'
        ? t('nav.progress')
        : section === 'practice'
          ? t('nav.practice')
          : section === 'report'
            ? t('nav.report')
            : section === 'settings'
              ? t('settings.title')
              : section === 'activity'
                ? t('activity.title')
                : section === 'account'
                  ? t('account.title')
                  : t('dashboard.title')

  return (
    <div className="fl-dash">
      <aside className="fl-dash-sidebar">
        <div className="fl-dash-brand">
          <PopupLogo />
          <div>
            <p className="fl-dash-brand-name">{t('brand.name')}</p>
            <p className="fl-dash-brand-sub">{t('dashboard.title')}</p>
          </div>
        </div>

        <nav className="fl-dash-nav" aria-label={t('dashboard.title')} data-tour="nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey} className="fl-dash-nav-group">
              <p className="fl-dash-nav-label">{t(`dashboard.${group.labelKey}`)}</p>
              <div className="fl-dash-nav-items">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`fl-dash-nav-btn${section === item.id ? ' is-active' : ''}`}
                    aria-current={section === item.id ? 'page' : undefined}
                    data-tour={`nav-${item.id}`}
                    onClick={() => go(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="fl-dash-sidebar-foot">
          <span className="fl-dash-version">v{status?.version ?? BRAND.version}</span>
        </div>
      </aside>

      <div className="fl-dash-shell">
        <header className="fl-dash-topbar">
          <p className="fl-dash-kicker">{pageTitle}</p>
          <div className="fl-dash-topbar-status">
            <HeaderStatusPill domain={domain} />
          </div>
          <div className="fl-header-actions" data-tour="account">
            <ThemeToggle />
            <AccountAvatar
              signedIn={Boolean(status?.account.signedIn)}
              email={status?.account.email ?? null}
              onClick={() => go('account')}
            />
          </div>
        </header>

        {error ? (
          <div className="fl-dash-content">
            <div className="fl-error fl-dash-error" role="alert">
              {error}
            </div>
          </div>
        ) : null}

        <main className="fl-dash-main">
          <div className="fl-dash-content">
            {loading && !status ? (
              <p className="fl-loading fl-skel" role="status">
                {t('connection.checking')}
              </p>
            ) : null}

            {status && domain && section === 'overview' ? (
              <OverviewPanel
                status={status}
                domain={domain}
                loading={loading}
                busy={busy}
                {...mutations}
                onOpenAccount={() => go('account')}
                onOpenSettings={() => go('settings')}
                onSetupLearning={() => void beginLearningSetup()}
                onDismissLearningSetup={() => void dismissLearningSetupPrompt()}
                setupBusy={onboardingBusy || busy === 'learning-dismiss'}
                onOpenProgress={() => go('progress')}
                onOpenPractice={(target) => go('practice', target ? { practiceTarget: target } : undefined)}
                onOpenReport={() => go('report')}
                onReplayTour={() => void startDashboardTour()}
              />
            ) : null}

            {section === 'progress' ? (
              <DashboardPage lead={t('dashboard.progressLead')}>
                <ProgressPanel
                  learningSummary={status?.learning.summary ?? null}
                  onOpenActivity={() => go('activity')}
                  onOpenPractice={() => go('practice')}
                  advanced={Boolean(
                    status?.entitlement.capabilities.includes('progress.advanced') ||
                      status?.entitlement.isPro ||
                      status?.entitlement.inTrial,
                  )}
                />
              </DashboardPage>
            ) : null}

            {section === 'practice' ? (
              <DashboardPage lead={t('dashboard.practiceLead')}>
                <PracticeSection
                  status={status}
                  onOpenOverview={() => go('overview')}
                  onOpenProgress={() => go('progress')}
                  fullAccess={Boolean(
                    status?.entitlement.capabilities.includes('practice.full') ||
                      status?.entitlement.isPro ||
                      status?.entitlement.inTrial,
                  )}
                  initialTargetPatternId={practiceTargetId}
                />
              </DashboardPage>
            ) : null}

            {section === 'report' ? (
              <LearningReportPanel
                signedIn={Boolean(status?.account.signedIn)}
                onOpenAccount={() => go('account')}
                onOpenPractice={(target) => go('practice', target ? { practiceTarget: target } : undefined)}
              />
            ) : null}

            {status && section === 'account' ? (
              <AccountPanel status={status} busy={busy} onMutate={mutate} />
            ) : null}

            {status && section === 'settings' ? (
              <SettingsPanel
                  status={status}
                  busy={busy}
                  onMutate={mutate}
                  onStatus={session.setStatus}
                  onRestartOnboarding={() => void beginLearningSetup()}
                  onReplayTour={() => void startDashboardTour()}
                  onStatusRefresh={refreshStatus}
                  onOpenActivity={() => go('activity')}
                  onOpenProgress={() => go('progress')}
                />
            ) : null}

            {section === 'activity' ? (
              <DashboardPage lead={t('dashboard.activityLead')}>
                <HistoryPanel
                  hideHeader
                  busy={busy}
                  setBusy={session.setBusy}
                  setError={session.setError}
                />
              </DashboardPage>
            ) : null}
          </div>
        </main>
      </div>

      {status && learningProfile && onboardingOpen ? (
        <OnboardingFlow
          status={status}
          profile={learningProfile}
          busy={onboardingBusy}
          onStatusChange={session.setStatus}
          onProfileChange={setLearningProfile}
          onComplete={(profile) => void finishOnboarding(profile)}
        />
      ) : null}

      <DashboardTour open={tourOpen && !onboardingOpen} onNavigate={go} onClose={() => setTourOpen(false)} />
    </div>
  )
}
