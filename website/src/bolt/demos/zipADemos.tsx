import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Check, Copy, Eye, EyeOff, Keyboard, Languages, Mail, PenLine, X, Zap } from 'lucide-react'
import { useMessages, useI18n } from '../../i18n/index.tsx'

export function InFieldDemo() {
  const t = useMessages()
  const scenarios = t.pages.demo.inField
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'typing' | 'detecting' | 'suggest' | 'applied'>('idle')
  const [text, setText] = useState('')
  const [pinned, setPinned] = useState(false)
  const scenario = scenarios[idx]
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const reset = useCallback(() => {
    setPhase('idle')
    setText('')
  }, [])

  const selectScene = useCallback(
    (next: number) => {
      setIdx(next)
      setPinned(true)
      setPhase('idle')
      setText('')
    },
    [],
  )

  useEffect(() => {
    if (phase === 'idle') timer.current = setTimeout(() => setPhase('typing'), 500)
    else if (phase === 'typing') {
      if (text.length < scenario.typed.length) {
        timer.current = setTimeout(() => setText(scenario.typed.slice(0, text.length + 1)), 70)
      } else timer.current = setTimeout(() => setPhase('detecting'), 400)
    } else if (phase === 'detecting') timer.current = setTimeout(() => setPhase('suggest'), 600)
    else if (phase === 'suggest') timer.current = setTimeout(() => setPhase('applied'), 1400)
    else if (phase === 'applied') {
      setText(scenario.fixed)
      timer.current = setTimeout(() => {
        setPinned(false)
        setIdx((i) => (pinned ? i : (i + 1) % scenarios.length))
        reset()
      }, 2200)
    }
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [phase, text, scenario, reset, scenarios.length, pinned])

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-400" />
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <div className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 rounded-md bg-white px-3 py-1 font-mono text-xs text-slate-500 dark:bg-slate-700">{scenario.host}</div>
      </div>
      <div className="relative min-h-[220px] p-4 sm:min-h-[260px] sm:p-6">
        <div className="hp-demo-scenes" role="tablist" aria-label={t.pages.demo.examples}>
          {scenarios.map((item, index) => (
            <button
              key={item.host}
              type="button"
              role="tab"
              aria-selected={index === idx}
              className={index === idx ? 'is-on' : undefined}
              onClick={() => selectScene(index)}
            >
              {item.action}
            </button>
          ))}
        </div>
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
          <Mail className="h-4 w-4" />
          {t.pages.demo.newMessage}
        </div>
        <div className="relative mt-4 min-h-[100px] rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <span className={phase === 'applied' ? 'text-green-600' : 'text-slate-900 dark:text-slate-100'} dir="auto">
            {text}
          </span>
          {phase === 'typing' ? <span className="animate-blink text-sky-500">|</span> : null}
          {phase === 'suggest' ? (
            <div className="absolute bottom-full start-0 z-10 mb-2 max-w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 text-xs font-semibold text-sky-600">{scenario.action}</p>
              <p className="text-sm">
                <span className="text-rose-500 line-through">{scenario.typed}</span>
                {' → '}
                <span className="font-medium text-green-600">{scenario.fixed}</span>
              </p>
            </div>
          ) : null}
        </div>
        <p className="mt-4 text-xs text-slate-500">{scenario.label}</p>
      </div>
    </div>
  )
}

export function CompactJobDemos() {
  const t = useMessages()
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <JobCard
        icon={<Keyboard className="h-4 w-4" />}
        title={t.pages.demo.layout}
        examples={[
          { before: 'lvpfh', after: 'مرحبا' },
          { before: 'wfhp hgodb', after: 'صباح الخير' },
        ]}
      />
      <JobCard
        icon={<PenLine className="h-4 w-4" />}
        title={t.pages.demo.fix}
        examples={[
          { before: 'I recieved the report', after: 'I received the report' },
          { before: 'See you next weak', after: 'See you next week' },
        ]}
      />
      <JobCard
        icon={<Languages className="h-4 w-4" />}
        title={t.pages.demo.translate}
        examples={[
          { before: 'Can we move the deadline?', after: 'هل يمكننا تأجيل الموعد؟' },
          { before: 'Thank you for your time', after: 'شكراً على وقتك' },
        ]}
      />
    </div>
  )
}

function JobCard({
  icon,
  title,
  examples,
}: {
  icon: ReactNode
  title: string
  examples: readonly { before: string; after: string }[]
}) {
  const [done, setDone] = useState(false)
  const [index, setIndex] = useState(0)
  const example = examples[index] ?? examples[0]
  useEffect(() => {
    const t = window.setInterval(() => {
      setDone((showing) => {
        if (showing) {
          setIndex((current) => (current + 1) % examples.length)
          return false
        }
        return true
      })
    }, 2800)
    return () => window.clearInterval(t)
  }, [examples.length])
  return (
    <div className="card p-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10">{icon}</span>
        {title}
      </div>
      <p className={`mb-3 rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm dark:bg-slate-800 ${done ? 'text-slate-400 line-through' : ''}`} dir="auto">
        {example.before}
      </p>
      <div className="mb-3 flex justify-center text-sky-500">
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
      </div>
      <p className={`rounded-xl border px-3 py-2 font-mono text-sm transition-all ${done ? 'animate-scale-in border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200' : 'border-transparent text-transparent'}`} dir="auto">
        {example.after}
      </p>
    </div>
  )
}

export function LiveTranslationDemo() {
  const t = useMessages()
  const d = t.pages.demo
  const steps = [
    { ar: 'مرحبا', en: 'hello' },
    { ar: 'مرحباً، كيف حالك؟', en: 'hello, how are you?' },
    { ar: 'هل يمكننا تأجيل الموعد؟', en: 'can we postpone the deadline?' },
  ]
  const [on, setOn] = useState(false)
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setStep((s) => (s + 1) % steps.length), 1800)
    return () => clearInterval(t)
  }, [on, steps.length])
  const current = on ? steps[step] : { ar: '', en: '' }
  return (
    <div className="card hp-demo-fill p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {on ? <Eye className="h-4 w-4 text-sky-500" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
          {t.pages.cards['live-translation'].title}
        </div>
        <button type="button" onClick={() => setOn((v) => !v)} className={`relative h-6 w-11 rounded-full ${on ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'start-5' : 'start-0.5'}`} />
        </button>
      </div>
      <div className="flex flex-1 flex-col justify-center space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <p className="mb-1 text-xs text-slate-500">العربية</p>
          <p dir="rtl" className="min-h-[28px] font-arabic text-lg">{current.ar || (on ? '…' : '')}</p>
        </div>
        <div className="h-px bg-slate-200 dark:bg-slate-700" />
        <div>
          <p className="mb-1 text-xs text-slate-500">English</p>
          <p className={`min-h-[28px] text-lg ${on ? 'text-sky-600' : 'text-slate-400'}`}>
            {on ? current.en : d.liveOff}
          </p>
        </div>
      </div>
    </div>
  )
}

const SPEED = [
  { mode: 'layout' as const, input: 'lvpfh', output: 'مرحبا' },
  { mode: 'translate' as const, input: 'Thank you for your time', output: 'شكراً على وقتك' },
  { mode: 'fix' as const, input: 'I recieved your email', output: 'I received your email' },
]

export function SpeedBoxDemo() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const d = t.pages.demo
  const [mode, setMode] = useState<'layout' | 'translate' | 'fix'>('layout')
  const demo = SPEED.find((item) => item.mode === mode) ?? SPEED[0]
  const [copied, setCopied] = useState(false)
  const modes = [
    { id: 'layout' as const, label: d.layout, icon: Keyboard },
    { id: 'translate' as const, label: d.translate, icon: Languages },
    { id: 'fix' as const, label: d.fix, icon: PenLine },
  ]
  return (
    <div className="card hp-demo-fill overflow-hidden p-4">
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/80 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/75${locale === 'ar' || locale === 'fa' ? ' font-arabic' : ''}`}
        dir={direction}
        lang={locale}
      >
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3 dark:border-slate-700/70">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap className="h-4 w-4 text-sky-500" />
            {d.speedBox}
          </div>
          <X className="h-4 w-4 text-slate-400" />
        </div>
        <div className="flex gap-1 p-2">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium ${mode === item.id ? 'bg-sky-500 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'}`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col justify-center space-y-2 px-3 pb-3">
          <p className="text-[10px] text-slate-500">{d.speedInput}</p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800">{demo.input}</div>
          <p className="text-[10px] text-sky-600">{mode === 'layout' ? d.speedFree : d.speedCheck}</p>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 font-mono text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">{demo.output}</div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary flex-1 py-2 text-xs">
              {d.apply}
            </button>
            <button
              type="button"
              className="btn-secondary py-2 text-xs"
              onClick={() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1200)
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? d.copied : d.copy}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
