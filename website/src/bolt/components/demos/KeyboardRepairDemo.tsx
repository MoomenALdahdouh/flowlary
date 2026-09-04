import { useState, useEffect, useCallback } from 'react'
import { ArrowRight, Check, Sparkles, RotateCcw } from 'lucide-react'
import { useMessages } from '../../../i18n/index.tsx'

const LAYOUT_TYPED = 'wfhp hgodb'
const LAYOUT_FIXED = 'صباح الخير'
const JOB_COUNT = 3

const STEPS = [
  { until: 4 },
  { until: 9 },
  { until: LAYOUT_FIXED.length },
]

type Phase = 'typing' | 'detected' | 'repairing' | 'done'

export default function KeyboardRepairDemo({
  job = 0,
  onJobComplete,
}: {
  job?: number
  onJobComplete?: (next: number) => void
}) {
  const d = useMessages().pages.demo
  const scenes = d.inField
  const safeJob = ((job % JOB_COUNT) + JOB_COUNT) % JOB_COUNT
  const isLayout = safeJob === 0
  const scene = scenes[safeJob] ?? scenes[0]
  const typedSource = isLayout ? LAYOUT_TYPED : scene.typed
  const fixedSource = isLayout ? LAYOUT_FIXED : scene.fixed
  const host = isLayout ? 'mail.google.com' : scene.host
  const detectingLabel = isLayout ? d.mixup : scene.action
  const doneLabel = isLayout ? d.repairedTo : safeJob === 1 ? d.fixedInField : d.translatedInField

  const [phase, setPhase] = useState<Phase>('typing')
  const [typedWrong, setTypedWrong] = useState('')
  const [stepIndex, setStepIndex] = useState(0)

  const reset = useCallback(() => {
    setPhase('typing')
    setTypedWrong('')
    setStepIndex(0)
  }, [])

  useEffect(() => {
    reset()
  }, [safeJob, reset])

  useEffect(() => {
    if (phase === 'typing') {
      if (typedWrong.length < typedSource.length) {
        const timer = setTimeout(() => {
          setTypedWrong(typedSource.slice(0, typedWrong.length + 1))
        }, isLayout ? 120 : 55)
        return () => clearTimeout(timer)
      }
      const timer = setTimeout(() => setPhase('detected'), 600)
      return () => clearTimeout(timer)
    }

    if (phase === 'detected') {
      const timer = setTimeout(() => setPhase(isLayout ? 'repairing' : 'done'), isLayout ? 800 : 1100)
      return () => clearTimeout(timer)
    }

    if (phase === 'repairing') {
      if (stepIndex < STEPS.length) {
        const timer = setTimeout(() => setStepIndex(stepIndex + 1), 700)
        return () => clearTimeout(timer)
      }
      const timer = setTimeout(() => setPhase('done'), 500)
      return () => clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      if (onJobComplete) onJobComplete((safeJob + 1) % JOB_COUNT)
      else reset()
    }, 3200)
    return () => clearTimeout(timer)
  }, [phase, typedWrong, stepIndex, reset, typedSource, isLayout, onJobComplete, safeJob])

  const repairedLen = STEPS[Math.max(0, stepIndex - 1)]?.until ?? 0

  return (
    <div className="kr-hero-frame relative mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-amber-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
          </div>
          <div className="ms-3 flex-1 rounded-md border border-slate-200 bg-white px-3 py-1 font-mono text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500">
            {host}
          </div>
        </div>

        <div className="p-4 sm:p-8">
          <div className="mb-4 text-xs font-medium text-slate-400 dark:text-slate-500">{d.newMessage}</div>

          <div className="mb-3 border-b border-slate-100 pb-2 dark:border-slate-800">
            <span className="text-xs text-slate-400 dark:text-slate-500">To: </span>
            <span className="text-sm text-slate-600 dark:text-slate-400">team@company.com</span>
          </div>

          <div className="min-h-[80px] rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <div className="text-lg leading-loose text-slate-800 dark:text-slate-200" dir="auto">
              {phase === 'typing' && (
                <span>
                  {typedWrong}
                  <span className="animate-blink text-sky-500 dark:text-sky-400">|</span>
                </span>
              )}
              {phase === 'detected' && (
                <span className="text-slate-500">
                  {typedSource}
                  <span className="animate-blink text-sky-500 dark:text-sky-400">|</span>
                </span>
              )}
              {phase === 'repairing' && (
                <span>
                  <span className="font-arabic text-slate-800 dark:text-slate-200">{LAYOUT_FIXED.slice(0, repairedLen)}</span>
                  <span className="text-slate-400">{LAYOUT_TYPED.slice(repairedLen)}</span>
                  <span className="animate-blink text-sky-500 dark:text-sky-400">|</span>
                </span>
              )}
              {phase === 'done' && (
                <span className="animate-fade-in text-slate-800 dark:text-slate-200">{fixedSource}</span>
              )}
            </div>
          </div>

          <div
            className={`mt-3 flex items-center gap-3 overflow-hidden rounded-lg border transition-all duration-500 ${
              phase === 'detected' || phase === 'repairing' || phase === 'done'
                ? 'border-sky-200 bg-sky-50 opacity-100 dark:border-sky-500/30 dark:bg-sky-500/10'
                : 'border-transparent opacity-0'
            }`}
          >
            <div className="flex items-center gap-2 px-4 py-3">
              {phase === 'done' ? (
                <Check className="h-4 w-4 text-sky-500" />
              ) : (
                <Sparkles className="h-4 w-4 text-sky-500 dark:text-sky-400" />
              )}
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {phase === 'done' ? doneLabel : detectingLabel}
              </span>
            </div>
            {phase === 'done' && (
              <button
                type="button"
                className="ms-auto flex items-center gap-1 px-4 py-3 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500"
                onClick={reset}
              >
                <RotateCcw className="h-3 w-3" />
                {d.undo}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="absolute -end-4 -top-6 hidden rotate-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-lg sm:block dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          <ArrowRight className="h-3.5 w-3.5 text-sky-500 rtl:rotate-180 dark:text-sky-400" />
          {d.noSwitch}
        </div>
      </div>
    </div>
  )
}
