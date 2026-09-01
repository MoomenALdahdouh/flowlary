import { BRAND } from '@flowlary/shared'
import { PopupLogo, ThemeToggle, AccountAvatar } from './components.tsx'
import { t } from './i18n/index.ts'
import { HeaderStatusPill } from '../ui/SystemStatus.tsx'
import { useFeatureMutations } from '../ui/useFeatureMutations.ts'
import { resolveAccountPlanLabel } from './status.ts'
import { openDashboard } from './openDashboard.ts'
import { useExtensionSession } from './useExtensionSession.ts'
import { HomeView } from './views/HomeView.tsx'
import { ContextualFeedbackPrompt, HelpFeedbackLink } from './components/ContextualFeedbackPrompt.tsx'
import { FirstWinView } from './views/FirstWinView.tsx'
import {
  dispatchCommand,
  fetchDailyBrief,
  fetchStatus,
  markFirstWin,
  patchWritingPolicy,
  PopupApiError,
} from './api.ts'
import { policyPatchFromFirstWin } from '../core/policy/writingPolicy.ts'
import type { FirstWinAnswers } from './views/FirstWinView.tsx'
import { useEffect, useState } from 'react'
import { openDashboard as openDash } from './openDashboard.ts'

export function App() {
  const session = useExtensionSession()
  const { status, loading, busy, error, domain, mutate, setError } = session
  const mutations = useFeatureMutations(session)
  const [briefLine, setBriefLine] = useState<string | null>(null)

  const showFirstWin = Boolean(status && !status.firstWin?.completed)

  useEffect(() => {
    if (!status?.account.signedIn || showFirstWin) {
      setBriefLine(null)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      if (!cancelled) setBriefLine(null)
    }, 4000)
    void fetchDailyBrief()
      .then((brief) => {
        if (cancelled) return
        clearTimeout(timer)
        const focus = brief.focusCategory
        if (focus) {
          setBriefLine(t('popup.briefTeaser', { focus }))
        }
      })
      .catch(() => {
        if (!cancelled) setBriefLine(null)
      })
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [status?.account.signedIn, showFirstWin])

  async function completeFirstWin(patch: { completed?: boolean; localSuccess?: boolean }) {
    await mutate('first-win', async () => {
      await markFirstWin({ completed: true, ...patch })
      return fetchStatus()
    })
  }

  async function handleTryLayout() {
    setError(null)
    try {
      await dispatchCommand('FIX_LAYOUT')
      await completeFirstWin({ localSuccess: true })
    } catch (err) {
      setError(err instanceof PopupApiError ? err.message : t('errors.saveSettings'))
    }
  }

  async function handleFirstWinSave(answers: FirstWinAnswers) {
    setError(null)
    try {
      await mutate('first-win', async () => {
        const mapped = policyPatchFromFirstWin(answers)
        await patchWritingPolicy(mapped.policy)
        await markFirstWin({ completed: true })
        return fetchStatus()
      })
    } catch (err) {
      setError(err instanceof PopupApiError ? err.message : t('errors.saveSettings'))
    }
  }

  return (
    <div className="fl-popup">
      <header className="fl-header">
        <div className="fl-brand-block">
          <PopupLogo />
          <div>
            <h1 className="fl-title">{t('brand.name')}</h1>
            <p className="fl-subtitle">{t('brand.tagline')}</p>
          </div>
        </div>
        <div className="fl-header-actions">
          <HeaderStatusPill domain={domain} />
          <ThemeToggle />
          <AccountAvatar
            signedIn={Boolean(status?.account.signedIn)}
            email={status?.account.email ?? null}
            onClick={() => openDashboard('account')}
          />
        </div>
      </header>

      {error ? (
        <div className="fl-error" role="alert">
          <p>{error}</p>
          {error.includes('editable') || error.includes('page') ? (
            <button type="button" className="fl-link-btn" onClick={() => void handleTryLayout()}>
              {t('errors.retryLayout')}
            </button>
          ) : null}
        </div>
      ) : null}

      <main className="fl-main">
        {loading && !status ? (
          <p className="fl-loading fl-skel" role="status">
            {t('connection.checking')}
          </p>
        ) : null}

        {showFirstWin ? (
          <FirstWinView
            busy={busy === 'first-win'}
            onSave={(answers) => void handleFirstWinSave(answers)}
            onSkip={() =>
              void handleFirstWinSave({
                fixWrongTyping: true,
                improveEnglishAuto: true,
                arabicToEnglishMode: false,
              })
            }
          />
        ) : null}

        {status && !showFirstWin ? (
          <>
            <ContextualFeedbackPrompt signedIn={Boolean(status.account.signedIn)} />
            <HomeView
            status={status}
            domain={domain}
            loading={loading}
            busy={busy}
            showSignInBanner={!status.firstWin?.localSuccess && !status.firstWin?.aiSuccess}
            {...mutations}
            onOpenDashboard={openDashboard}
          />
          </>
        ) : null}
      </main>

      {status ? (
        <footer className="fl-popup-footbar">
          <div className="fl-popup-footbar-main">
            <span>{resolveAccountPlanLabel(status)}</span>
            {briefLine ? (
              <button
                type="button"
                className="fl-link-btn fl-popup-brief-teaser"
                onClick={() => openDash('overview')}
              >
                {briefLine}
              </button>
            ) : null}
          </div>
          <button type="button" className="fl-link-btn fl-dash-open" onClick={() => openDashboard()}>
            {t('dashboard.open')}
          </button>
          <HelpFeedbackLink />
        </footer>
      ) : (
        <footer className="fl-footer">
          <span>v{BRAND.version}</span>
        </footer>
      )}
    </div>
  )
}
