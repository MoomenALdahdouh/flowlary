import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Check, Sparkles, Keyboard, Languages, RotateCcw } from 'lucide-react';
import { useApp } from '@/shared/AppContext';
import { Button } from '@/shared/ui/Button';

type DemoPhase = 'idle' | 'typing-wrong' | 'detecting' | 'showing-suggestion' | 'applied';
type DemoType = 'layout' | 'writing' | 'translate';

const scenarios: {
  type: DemoType;
  host: string;
  typed: string;
  fixed: string;
  label: string;
  labelAr: string;
}[] = [
  { type: 'layout', host: 'mail.google.com', typed: 'lvpfh، كيف حالك؟', fixed: 'مرحبا، كيف حالك؟', label: 'Wrong keyboard layout in Gmail', labelAr: 'تخطيط لوحة مفاتيح خاطئ في Gmail' },
  { type: 'writing', host: 'docs.google.com', typed: 'I recieved the report yesturday', fixed: 'I received the report yesterday', label: 'Spelling in Google Docs', labelAr: 'إملاء في Google Docs' },
  { type: 'translate', host: 'web.whatsapp.com', typed: 'See you tomorrow at the meeting', fixed: 'أراك غداً في الاجتماع', label: 'Translate in WhatsApp Web', labelAr: 'ترجمة في WhatsApp Web' },
];

export function InFieldDemo({ autoPlay = true }: { autoPlay?: boolean }) {
  const { lang } = useApp();
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<DemoPhase>('idle');
  const [text, setText] = useState('');
  const [showSuggestion, setShowSuggestion] = useState(false);
  const scenario = scenarios[scenarioIdx];
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const reset = useCallback(() => {
    setPhase('idle');
    setText('');
    setShowSuggestion(false);
  }, []);

  const next = useCallback(() => {
    setScenarioIdx(i => (i + 1) % scenarios.length);
    reset();
  }, [reset]);

  useEffect(() => {
    if (phase === 'idle') {
      timerRef.current = setTimeout(() => setPhase('typing-wrong'), 600);
    } else if (phase === 'typing-wrong') {
      if (text.length < scenario.typed.length) {
        timerRef.current = setTimeout(() => setText(scenario.typed.slice(0, text.length + 1)), 80);
      } else {
        timerRef.current = setTimeout(() => setPhase('detecting'), 400);
      }
    } else if (phase === 'detecting') {
      timerRef.current = setTimeout(() => setPhase('showing-suggestion'), 600);
    } else if (phase === 'showing-suggestion') {
      setShowSuggestion(true);
      if (autoPlay) {
        timerRef.current = setTimeout(() => setPhase('applied'), 1500);
      }
    } else if (phase === 'applied') {
      setText(scenario.fixed);
      setShowSuggestion(false);
      if (autoPlay) {
        timerRef.current = setTimeout(() => next(), 2500);
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, text, scenario, autoPlay, next]);

  const icon = scenario.type === 'layout' ? <Keyboard className="w-3.5 h-3.5" /> :
              scenario.type === 'writing' ? <Check className="w-3.5 h-3.5" /> :
              <Languages className="w-3.5 h-3.5" />;

  const actionLabel = scenario.type === 'layout' ? (lang === 'ar' ? 'إصلاح التخطيط' : 'Fix layout') :
                      scenario.type === 'writing' ? (lang === 'ar' ? 'إصلاح الكتابة' : 'Fix writing') :
                      (lang === 'ar' ? 'ترجمة' : 'Translate');

  return (
    <div className="card-surface overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-error-400" />
          <div className="w-3 h-3 rounded-full bg-accent-400" />
          <div className="w-3 h-3 rounded-full bg-success-400" />
        </div>
        <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md bg-white dark:bg-secondary-700 text-xs text-secondary-500 font-mono">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          {scenario.host}
        </div>
      </div>

      {/* Page content */}
      <div className="p-6 bg-white dark:bg-secondary-900 min-h-[280px] relative">
        {/* Email compose mock */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-secondary-500">
            <Mail className="w-4 h-4" />
            <span>{lang === 'ar' ? 'رسالة جديدة' : 'New message'}</span>
          </div>
          <div className="h-px bg-secondary-100 dark:bg-secondary-800" />
          <div className="flex gap-2 text-sm">
            <span className="text-secondary-500 font-medium">To:</span>
            <span className="text-secondary-700 dark:text-secondary-300">colleague@company.com</span>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="text-secondary-500 font-medium">Subject:</span>
            <span className="text-secondary-700 dark:text-secondary-300">
              {lang === 'ar' ? 'متابعة الاجتماع' : 'Meeting follow-up'}
            </span>
          </div>
          <div className="relative mt-4">
            <div className="rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800/30 p-4 min-h-[100px] text-base leading-relaxed">
              <span className={phase === 'applied' ? 'text-success-600 dark:text-success-400' : 'text-secondary-900 dark:text-secondary-100'}>
                {text}
              </span>
              {phase === 'typing-wrong' && <span className="cursor-blink" />}

              {/* Inline suggestion popup */}
              {showSuggestion && (
                <div className="absolute bottom-full mb-2 start-0 glass-strong rounded-xl shadow-xl p-3 max-w-sm animate-fade-in-up z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400">
                      {icon}
                    </div>
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{actionLabel}</span>
                    <span className="text-[10px] text-secondary-400 font-mono">⌘⇧F</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-error-500 line-through">{scenario.typed}</span>
                    <span className="text-secondary-400">→</span>
                    <span className="text-success-600 dark:text-success-400 font-medium">{scenario.fixed}</span>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <Button size="sm" className="text-xs py-1 px-2.5 h-auto">
                      <Check className="w-3 h-3" /> {lang === 'ar' ? 'تطبيق' : 'Apply'}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs py-1 px-2.5 h-auto">
                      {lang === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Detection indicator */}
              {phase === 'detecting' && (
                <div className="absolute -top-2 end-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-[10px] text-primary-600 dark:text-primary-400 animate-fade-in">
                  <Sparkles className="w-2.5 h-2.5 animate-pulse-soft" />
                  {lang === 'ar' ? 'تحليل…' : 'Analyzing…'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Success flash */}
        {phase === 'applied' && (
          <div className="absolute top-4 end-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300 text-xs font-medium animate-bounce-soft">
            <Check className="w-3.5 h-3.5" />
            {lang === 'ar' ? 'تم' : 'Done'}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
        <p className="text-xs text-secondary-500">
          {lang === 'ar' ? scenario.labelAr : scenario.label}
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="w-3 h-3" />} onClick={reset}>
            {lang === 'ar' ? 'إعادة' : 'Replay'}
          </Button>
          <Button variant="ghost" size="sm" onClick={next}>
            {lang === 'ar' ? 'التالي' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}
