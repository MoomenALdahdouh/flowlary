import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BRAND, type LearningProfile } from '@flowlary/shared'
import {
  dismissLearningSetup,
  fetchLearning,
  fetchStatus,
  restartLearningOnboarding,
} from '../popup/api.ts'
import { t, useI18n } from '../popup/i18n/index.ts'
import { FLOWLARY_SITE_URL } from '../config/endpoints.ts'
import { type DashboardSection } from '../config/dashboard.ts'
import { useExtensionSession } from '../popup/useExtensionSession.ts'
import { useFeatureMutations } from '../ui/useFeatureMutations.ts'
import { DashboardPage } from './DashboardPage.tsx'
import { DashboardShell, type DashboardNavGroup } from './DashboardShell.tsx'
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
import { openAccountSurface } from '../config/upgrade.ts'

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

function buildNavGroups(nav: {
  groupWrite: string
  groupLearn: string
  groupAccount: string
  overview: string
  practice: string
  progress: string
  report: string
  settings: string
  account: string
  activity: string
  support: string
}): DashboardNavGroup[] {
  return [
    {
      label: nav.groupWrite,
      items: [{ id: 'overview', label: nav.overview }],
    },
    {
      label: nav.groupLearn,
      items: [
        { id: 'practice', label: nav.practice },
        { id: 'progress', label: nav.progress },
        { id: 'report', label: nav.report },
      ],
    },
    {
      label: nav.groupAccount,
      items: [
        { id: 'settings', label: nav.settings },
        { id: 'account', label: nav.account },
        { id: 'activity', label: nav.activity },
        {
          id: 'support',
          label: nav.support,
          href: `${FLOWLARY_SITE_URL}/dashboard/support`,
        },
      ],
    },
  ]
}

export function DashboardApp() {
  const { messages } = useI18n()
  const nav = messages.dashboard.nav
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

  const navGroups = useMemo(() => buildNavGroups(nav), [nav])
  const flatNav = useMemo(() => navGroups.flatMap((group) => group.items), [navGroups])

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

  const openAccountEntry = useCallback(() => {
    openAccountSurface({
      signedIn: Boolean(status?.account.signedIn),
      openExtensionAccount: () => go('account'),
    })
  }, [go, status?.account.signedIn])

  const pageTitle =
    section === 'overview'
      ? nav.overview
      : section === 'progress'
        ? nav.progress
        : section === 'practice'
          ? nav.practice
          : section === 'report'
            ? nav.report
            : section === 'settings'
              ? nav.settings
              : section === 'activity'
                ? nav.activity
                : section === 'account'
                  ? nav.account
                  : t('dashboard.title')

  let panelContent: React.ReactNode = null

  if (error) {
    panelContent = (
      <div className="wd-panel-stack">
        <div className="wd-card wd-card-highlight">
          <p className="wd-error" role="alert">
            {error}
          </p>
        </div>
      </div>
    )
  } else if (loading && !status) {
    panelContent = (
      <div className="wd-panel-stack" aria-busy="true" aria-label={t('connection.checking')}>
        <div className="wd-skeleton wd-skeleton-title" />
        <div className="wd-skeleton wd-skeleton-line" />
        <article className="wd-card">
          <div className="wd-skeleton wd-skeleton-line" />
          <div className="wd-skeleton wd-skeleton-line wd-skeleton-short" />
        </article>
      </div>
    )
  } else if (status && domain && section === 'overview') {
    panelContent = (
      <OverviewPanel
        status={status}
        domain={domain}
        loading={loading}
        busy={busy}
        {...mutations}
        onOpenAccount={openAccountEntry}
        onOpenSettings={() => go('settings')}
        onSetupLearning={() => void beginLearningSetup()}
        onDismissLearningSetup={() => void dismissLearningSetupPrompt()}
        setupBusy={onboardingBusy || busy === 'learning-dismiss'}
        onOpenProgress={() => go('progress')}
        onOpenPractice={(target) => go('practice', target ? { practiceTarget: target } : undefined)}
        onOpenReport={() => go('report')}
        onOpenActivity={() => go('activity')}
        onReplayTour={() => void startDashboardTour()}
      />
    )
  } else if (section === 'progress') {
    panelContent = (
      <DashboardPage title={nav.progress} lead={t('dashboard.progressLead')}>
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
    )
  } else if (section === 'practice') {
    panelContent = (
      <DashboardPage title={nav.practice} lead={t('dashboard.practiceLead')}>
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
    )
  } else if (section === 'report') {
    panelContent = (
      <LearningReportPanel
        signedIn={Boolean(status?.account.signedIn)}
        onOpenAccount={openAccountEntry}
        onOpenPractice={(target) => go('practice', target ? { practiceTarget: target } : undefined)}
      />
    )
  } else if (status && section === 'account') {
    panelContent = (
      <DashboardPage title={nav.account} lead={t('dashboard.accountLead')}>
        <AccountPanel status={status} busy={busy} onMutate={mutate} />
      </DashboardPage>
    )
  } else if (status && section === 'settings') {
    panelContent = (
      <DashboardPage title={nav.settings} lead={t('dashboard.settingsLead')}>
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
      </DashboardPage>
    )
  } else if (section === 'activity') {
    panelContent = (
      <DashboardPage title={nav.activity} lead={t('dashboard.activityLead')}>
        <HistoryPanel hideHeader busy={busy} setBusy={session.setBusy} setError={session.setError} />
      </DashboardPage>
    )
  }

  return (
    <>
      <DashboardShell
        title={pageTitle}
        navGroups={navGroups}
        flatNav={flatNav}
        section={section}
        version={status?.version ?? BRAND.version}
        domain={domain}
        signedIn={Boolean(status?.account.signedIn)}
        email={status?.account.email ?? null}
        onNavigate={go}
        onOpenAccount={openAccountEntry}
      >
        {panelContent}
      </DashboardShell>

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
    </>
  )
}
