import { useState } from 'react'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { t } from '../../popup/i18n/index.ts'
import { LayoutPracticePanel } from './LayoutPracticePanel.tsx'
import { PracticePanel } from './PracticePanel.tsx'

type PracticeSectionProps = {
  status?: ExtensionStatus | null
  onOpenOverview: () => void
  onOpenProgress?: () => void
  fullAccess?: boolean
  initialTargetPatternId?: string
}

type PracticeTab = 'english' | 'layout'

export function PracticeSection({
  status,
  onOpenOverview,
  onOpenProgress,
  fullAccess,
  initialTargetPatternId,
}: PracticeSectionProps) {
  const [tab, setTab] = useState<PracticeTab>('english')

  return (
    <div className="fl-practice-section">
      <div className="fl-practice-tabs" role="tablist" aria-label={t('layoutPractice.tabListAria')}>
        <button
          type="button"
          role="tab"
          className={`fl-practice-tab ${tab === 'english' ? 'is-active' : ''}`}
          aria-selected={tab === 'english'}
          onClick={() => setTab('english')}
        >
          {t('layoutPractice.tabEnglish')}
        </button>
        <button
          type="button"
          role="tab"
          className={`fl-practice-tab ${tab === 'layout' ? 'is-active' : ''}`}
          aria-selected={tab === 'layout'}
          onClick={() => setTab('layout')}
        >
          {t('layoutPractice.tabLayout')}
        </button>
      </div>
      {tab === 'english' ? (
        <PracticePanel
          status={status}
          onOpenOverview={onOpenOverview}
          onOpenProgress={onOpenProgress}
          fullAccess={fullAccess}
          initialTargetPatternId={initialTargetPatternId}
        />
      ) : (
        <LayoutPracticePanel status={status} />
      )}
    </div>
  )
}
