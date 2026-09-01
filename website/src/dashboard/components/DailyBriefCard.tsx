import { useEffect, useState } from 'react'
import type { DailyLearningBrief } from '@flowlary/shared'
import { Button } from '../../components/Ui.tsx'
import type { DashboardCopy } from '../types.ts'
import { resolveWebDailyBrief } from '../services/learningData.ts'
import type { WebLearningBundle } from '../services/learningData.ts'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

type DailyBriefCardProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  onOpenPractice: (target?: string) => void
  onOpenProgress: () => void
}

export function DailyBriefCard({
  bundle,
  accountId,
  copy,
  onOpenPractice,
  onOpenProgress,
}: DailyBriefCardProps) {
  const [brief, setBrief] = useState<DailyLearningBrief | null>(null)

  useEffect(() => {
    setBrief(resolveWebDailyBrief(bundle, accountId))
  }, [bundle, accountId])

  if (!brief) {
    return (
      <article className="wd-card" aria-busy="true">
        <h3>{copy.overview.dailyBrief}</h3>
        <p className="wd-muted">{copy.brief.loading}</p>
      </article>
    )
  }

  let summary = copy.brief.empty
  if (brief.state === 'insufficient') summary = copy.brief.insufficient
  if (brief.state === 'ready') {
    if (brief.recurringPattern) {
      summary = fill(copy.brief.patternSummary, {
        from: brief.recurringPattern.displayOriginal,
        to: brief.recurringPattern.displayCorrected,
        count: brief.recurringPattern.count,
      })
    } else if (brief.focusCategory) {
      summary = fill(copy.brief.focusSummary, { area: brief.focusCategory })
    }
  }

  const action =
    brief.recommendedAction.kind === 'practice_pattern' || brief.recommendedAction.kind === 'practice_focus'
      ? copy.brief.practiceThis
      : brief.recommendedAction.kind === 'keep_writing'
        ? copy.brief.keepWriting
        : copy.brief.viewProgress

  return (
    <article className="wd-card">
      <h3>{copy.overview.dailyBrief}</h3>
      <p>{summary}</p>
      <div className="wd-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (brief.recommendedAction.kind === 'practice_pattern') {
              onOpenPractice(brief.recommendedAction.targetPatternId)
            } else if (brief.recommendedAction.kind === 'practice_focus') {
              onOpenPractice()
            } else if (brief.recommendedAction.kind === 'view_progress') {
              onOpenProgress()
            } else {
              window.location.href = '/#writing-lab'
            }
          }}
        >
          {action}
        </Button>
      </div>
    </article>
  )
}
