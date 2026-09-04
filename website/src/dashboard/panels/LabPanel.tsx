import { lazy, Suspense } from 'react'
import { FidelityBadge } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import type { DashboardCopy } from '../types.ts'

const WritingLab = lazy(() =>
  import('../../lab/WritingLab.tsx').then((module) => ({
    default: module.WritingLab,
  })),
)

export function LabPanel({
  copy,
  onOpenProgress,
  onOpenPractice,
}: {
  copy: DashboardCopy
  onOpenProgress: () => void
  onOpenPractice: (target?: string) => void
}) {
  const lab = useMessages().labPage

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <div className="wd-lab-head">
          <div>
            <h2>{copy.overview.writingLab}</h2>
            <p className="wd-lead">{lab.lead}</p>
          </div>
          <FidelityBadge mode="live" />
        </div>
      </header>
      <div className="wd-lab-features">
        {lab.features.map((item) => (
          <article key={item.title} className="wd-card">
            <h3>{item.title}</h3>
            <p className="wd-muted">{item.body}</p>
          </article>
        ))}
      </div>
      <p className="wd-muted wd-lab-disclaimer">{lab.disclaimer}</p>
      <div className="wd-lab-embed">
        <Suspense
          fallback={
            <div id="writing-lab" className="writing-lab min-h-[22rem] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" aria-busy="true" />
          }
        >
          <WritingLab embedded onOpenProgress={onOpenProgress} onOpenPractice={onOpenPractice} />
        </Suspense>
      </div>
    </div>
  )
}
