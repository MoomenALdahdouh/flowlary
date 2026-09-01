import type { ReactNode } from 'react'
import { t } from '../popup/i18n/index.ts'

type AiErrorRecoveryProps = {
  onRetry?: () => void
  onTryLayout?: () => void
  children?: ReactNode
}

/** Shared retry + local layout fallback actions for AI failures. */
export function AiErrorRecovery({ onRetry, onTryLayout, children }: AiErrorRecoveryProps) {
  if (!onRetry && !onTryLayout && !children) return null
  return (
    <div className="fl-error-actions">
      {children}
      {onRetry ? (
        <button type="button" className="fl-link-btn" onClick={onRetry}>
          {t('errors.retry')}
        </button>
      ) : null}
      {onTryLayout ? (
        <button type="button" className="fl-link-btn" onClick={onTryLayout}>
          {t('errors.retryLayout')}
        </button>
      ) : null}
    </div>
  )
}
