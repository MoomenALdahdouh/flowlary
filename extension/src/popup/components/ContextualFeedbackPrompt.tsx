import { useEffect, useState } from 'react'
import { FLOWLARY_SITE_URL } from '../../config/endpoints.ts'
import { t } from '../i18n/index.ts'
import {
  dismissFeedbackPrompt,
  fetchFeedbackEligibilityPopup,
  markFeedbackPromptShown,
  submitFeedbackMessage,
} from '../api.ts'

type ContextualFeedbackPromptProps = {
  signedIn: boolean
}

export function ContextualFeedbackPrompt({ signedIn }: ContextualFeedbackPromptProps) {
  const [promptId, setPromptId] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    void fetchFeedbackEligibilityPopup().then((result) => {
      if (cancelled || !result?.eligiblePrompts?.length) return
      const next = result.eligiblePrompts[0] ?? null
      setPromptId(next)
      setVisible(Boolean(next))
      if (next) void markFeedbackPromptShown(next)
    })
    return () => {
      cancelled = true
    }
  }, [signedIn])

  if (!visible || !promptId) return null

  async function dismiss(action: 'not_now' | 'dont_ask_again') {
    if (promptId) await dismissFeedbackPrompt(promptId, action)
    setVisible(false)
  }

  async function submitContextual(answer: string) {
    await submitFeedbackMessage({
      type: 'SATISFACTION',
      surface: 'contextual',
      feature: promptId.includes('correction')
        ? 'correction'
        : promptId.includes('translation')
          ? 'translation'
          : promptId.includes('layout')
            ? 'layout'
            : promptId.includes('learning')
              ? 'learning'
              : 'general',
      message: answer,
      promptId,
    })
    setVisible(false)
  }

  return (
    <aside className="fl-feedback-prompt" role="dialog" aria-label={t('feedback.promptTitle')}>
      <p>{t('feedback.promptTitle')}</p>
      <div className="fl-feedback-actions">
        <button type="button" className="fl-action-btn fl-action-btn-compact" onClick={() => void submitContextual('yes')}>
          {t('feedback.yes')}
        </button>
        <button type="button" className="fl-action-btn fl-action-btn-compact" onClick={() => void submitContextual('no')}>
          {t('feedback.no')}
        </button>
      </div>
      <div className="fl-feedback-dismiss">
        <button type="button" className="fl-link-btn" onClick={() => void dismiss('not_now')}>
          {t('feedback.notNow')}
        </button>
        <button type="button" className="fl-link-btn" onClick={() => void dismiss('dont_ask_again')}>
          {t('feedback.dontAskAgain')}
        </button>
      </div>
    </aside>
  )
}

export function HelpFeedbackLink() {
  const version = chrome.runtime.getManifest().version
  const params = new URLSearchParams({
    source: 'extension',
    tab: 'support',
    issueType: 'BUG',
  })
  params.set('extVersion', version)
  const href = `${FLOWLARY_SITE_URL}/feedback?${params.toString()}`
  return (
    <a className="fl-link-btn" href={href} target="_blank" rel="noopener noreferrer">
      {t('feedback.helpLink')}
    </a>
  )
}
