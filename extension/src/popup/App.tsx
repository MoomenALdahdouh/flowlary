import { BRAND } from '@flowlary/shared'
import { useEffect, useState } from 'react'
import { PopupLogo, ThemeToggle, AccountAvatar } from './components.tsx'
import { t } from './i18n/index.ts'
import { HeaderStatusPill } from '../ui/SystemStatus.tsx'
import { useFeatureMutations } from '../ui/useFeatureMutations.ts'
import { resolveAccountPlanLabel } from './status.ts'
import { openDashboard } from './openDashboard.ts'
import { openAccountSurface } from '../config/upgrade.ts'
import { useExtensionSession } from './useExtensionSession.ts'
import { HomeView } from './views/HomeView.tsx'
import { ContextualFeedbackPrompt, HelpFeedbackLink } from './components/ContextualFeedbackPrompt.tsx'
import { FirstWinView } from './views/FirstWinView.tsx'
import {
  dispatchCommand,
  fetchStatus,
  markFirstWin,
  patchWritingPolicy,
  PopupApiError,
} from './api.ts'
import { policyPatchFromFirstWin } from '../core/policy/writingPolicy.ts'
import type { FirstWinAnswers } from './views/FirstWinView.tsx'

export function App() {
  const session = useExtensionSession()
  const { status, loading, busy, error, domain, mutate, setError } = session
  const mutations = useFeatureMutations(session)

  const showFirstWin = Boolean(status && !status.firstWin?.completed)

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
          <h1 className="fl-title">{t('brand.name')}</h1>
        </div>
        <div className="fl-header-actions">
          <HeaderStatusPill domain={domain} />
          <ThemeToggle />
          <AccountAvatar
            signedIn={Boolean(status?.account.signedIn)}
            email={status?.account.email ?? null}
            onClick={() =>
              openAccountSurface({
                signedIn: Boolean(status?.account.signedIn),
                openExtensionAccount: () => openDashboard('account'),
              })
            }
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
              onGlobalToggle={mutations.onGlobalToggle}
              onSiteExcludedChange={mutations.onSiteExcludedChange}
              onOpenDashboard={openDashboard}
              onDispatchCorrect={mutations.onDispatchCorrect}
              onDispatchTranslate={mutations.onDispatchTranslate}
              onDispatchLayout={mutations.onDispatchLayout}
            />
          </>
        ) : null}
      </main>

      {status ? (
        <footer className="fl-popup-footbar">
          <span>{resolveAccountPlanLabel(status)}</span>
          <div className="fl-popup-footbar-actions">
            <button type="button" className="fl-link-btn" onClick={() => openDashboard()}>
              {t('dashboard.open')}
            </button>
            <HelpFeedbackLink />
          </div>
        </footer>
      ) : (
        <footer className="fl-footer">
          <span>v{BRAND.version}</span>
        </footer>
      )}
    </div>
  )
}
