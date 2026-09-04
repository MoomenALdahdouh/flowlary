import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, RotateCcw, Keyboard, Sparkles } from 'lucide-react';
import { useApp } from '@/shared/AppContext';
import { keyboardDemos } from '@/shared/demos';
import { Button } from '@/shared/ui/Button';

export function KeyboardLayoutDemo({ autoPlay = true, compact = false }: { autoPlay?: boolean; compact?: boolean }) {
  const { lang } = useApp();
  const [demoIndex, setDemoIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'converting' | 'done'>('typing');
  const [displayed, setDisplayed] = useState('');
  const demo = keyboardDemos[demoIndex];

  const reset = useCallback(() => {
    setPhase('typing');
    setDisplayed('');
  }, []);

  const next = useCallback(() => {
    setDemoIndex(i => (i + 1) % keyboardDemos.length);
    reset();
  }, [reset]);

  useEffect(() => {
    if (phase === 'typing') {
      if (displayed.length < demo.input.length) {
        const timer = setTimeout(() => setDisplayed(demo.input.slice(0, displayed.length + 1)), 120);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => setPhase('converting'), 500);
        return () => clearTimeout(timer);
      }
    } else if (phase === 'converting') {
      const timer = setTimeout(() => setPhase('done'), 800);
      return () => clearTimeout(timer);
    } else if (phase === 'done' && autoPlay) {
      const timer = setTimeout(() => next(), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, displayed, demo.input, autoPlay, next]);

  return (
    <div className={`card-surface p-6 ${compact ? '' : 'sm:p-8'} overflow-hidden`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <Keyboard className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
            {lang === 'ar' ? 'إصلاح التخطيط' : 'Fix Layout'}
          </span>
        </div>
        <span className="text-xs text-secondary-500 font-mono">
          {demo.from === 'en' ? 'EN layout' : 'AR layout'} → {demo.to === 'ar' ? 'AR text' : 'EN text'}
        </span>
      </div>

      <div className="space-y-4">
        {/* Input field */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-secondary-500">
              {lang === 'ar' ? 'ما كتبته' : 'What you typed'}
            </span>
            {phase === 'typing' && <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-soft" />}
          </div>
          <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 px-4 py-3 font-mono text-lg">
            <span className={phase === 'done' ? 'text-secondary-400 line-through' : 'text-secondary-900 dark:text-secondary-100'}>
              {displayed}
            </span>
            {phase === 'typing' && <span className="cursor-blink" />}
          </div>
        </div>

        {/* Arrow / conversion */}
        <div className="flex items-center justify-center">
          <div className={`flex items-center gap-2 transition-all duration-300 ${phase === 'converting' ? 'scale-110' : phase === 'done' ? 'opacity-100' : 'opacity-30'}`}>
            {phase === 'converting' ? (
              <Sparkles className="w-5 h-5 text-accent-500 animate-pulse-soft" />
            ) : (
              <ArrowRight className="w-5 h-5 text-primary-500 rtl:rotate-180" />
            )}
            <span className="text-xs text-secondary-500">
              {phase === 'typing' ? (lang === 'ar' ? 'في انتظار الإصلاح…' : 'waiting to fix…') :
               phase === 'converting' ? (lang === 'ar' ? 'جارٍ الإصلاح…' : 'fixing…') :
               (lang === 'ar' ? 'تم الإصلاح' : 'fixed')}
            </span>
          </div>
        </div>

        {/* Output */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-secondary-500">
              {lang === 'ar' ? 'ما قصدته' : 'What you meant'}
            </span>
          </div>
          <div className={`rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 px-4 py-3 font-mono text-lg transition-all duration-500 ${
            phase === 'done' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            <span className="text-primary-700 dark:text-primary-300" dir={demo.to === 'ar' ? 'rtl' : 'ltr'}>
              {phase === 'done' ? demo.output : ''}
              {phase === 'done' && <span className="cursor-blink" />}
            </span>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-secondary-500">{lang === 'ar' ? demo.labelAr : demo.label}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={reset}>
              {lang === 'ar' ? 'إعادة' : 'Replay'}
            </Button>
            <Button variant="ghost" size="sm" onClick={next}>
              {lang === 'ar' ? 'التالي' : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {keyboardDemos.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === demoIndex ? 'w-6 bg-primary-500' : 'w-1.5 bg-secondary-300 dark:bg-secondary-700'}`} />
        ))}
      </div>
    </div>
  );
}
