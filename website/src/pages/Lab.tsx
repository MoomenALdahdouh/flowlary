import { lazy, Suspense } from 'react'
import { LabShowcase } from '../components/lab/LabShowcase.tsx'

const WritingLab = lazy(() =>
  import('../lab/WritingLab.tsx').then((module) => ({
    default: module.WritingLab,
  })),
)

export function LabPage() {
  return (
    <LabShowcase
      workspace={
        <Suspense fallback={<div id="writing-lab" aria-busy="true" className="writing-lab" />}>
          <WritingLab />
        </Suspense>
      }
    />
  )
}
