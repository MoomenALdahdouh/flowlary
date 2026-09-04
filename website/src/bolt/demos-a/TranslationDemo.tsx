import { useState, useEffect, useCallback } from 'react';
import { Languages, ArrowRight, RotateCcw, Check } from 'lucide-react';
import { useApp } from '@/shared/AppContext';
import { translationDemos } from '@/shared/demos';
import { Button } from '@/shared/ui/Button';

export function TranslationDemo({ autoPlay = true, compact = false }: { autoPlay?: boolean; compact?: boolean }) {
  const { lang } = useApp();
  const [demoIndex, setDemoIndex] = useState(0);
  const [phase, setPhase] = useState<'input' | 'translating' | 'done'>('input');
  const [displayed, setDisplayed] = useState('');
  const demo = translationDemos[demoIndex];

  const reset = useCallback(() => {
    setPhase('input');
    setDisplayed('');
  }, []);

  const next = useCallback(() => {
    setDemoIndex(i => (i + 1) % translationDemos.length);
    reset();
  }, [reset]);

  useEffect(() => {
    if (phase === 'input') {
      if (displayed.length < demo.source.length) {
        const timer = setTimeout(() => setDisplayed(demo.source.slice(0, displayed.length + 1)), 40);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => setPhase('translating'), 500);
        return () => clearTimeout(timer);
      }
    } else if (phase === 'translating') {
      const timer = setTimeout(() => setPhase('done'), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'done' && autoPlay) {
      const timer = setTimeout(() => next(), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase, displayed, demo.source, autoPlay, next]);

  return (
    <div className={`card-surface p-6 ${compact ? '' : 'sm:p-8'}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <Languages className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
            {lang === 'ar' ? 'ترجمة' : 'Translate'}
          </span>
        </div>
        <span className="text-xs text-secondary-500">{demo.context}</span>
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-xs font-medium text-secondary-500 mb-1.5 block">
            {demo.sourceLang === 'en' ? 'English' : 'العربية'}
          </span>
          <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 px-4 py-3 min-h-[56px]">
            <p dir={demo.sourceLang === 'ar' ? 'rtl' : 'ltr'} className="text-base">
              {displayed}
              {phase === 'input' && <span className="cursor-blink" />}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className={`flex items-center gap-2 transition-all duration-300 ${phase === 'translating' ? 'scale-110' : phase === 'done' ? 'opacity-100' : 'opacity-30'}`}>
            <ArrowRight className="w-5 h-5 text-primary-500 rtl:rotate-180" />
            <span className="text-xs text-secondary-500">
              {phase === 'translating' ? (lang === 'ar' ? 'جارٍ الترجمة…' : 'translating…') :
               phase === 'done' ? (lang === 'ar' ? 'تمت الترجمة' : 'translated') :
               (lang === 'ar' ? 'في الانتظار' : 'waiting')}
            </span>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-secondary-500 mb-1.5 block">
            {demo.targetLang === 'en' ? 'English' : 'العربية'}
          </span>
          <div className={`rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 px-4 py-3 min-h-[56px] transition-all duration-500 ${
            phase === 'done' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}>
            <p dir={demo.targetLang === 'ar' ? 'rtl' : 'ltr'} className="text-base text-primary-700 dark:text-primary-300">
              {phase === 'done' ? demo.target : ''}
            </p>
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-secondary-500">
            {lang === 'ar' ? 'الترجمة في نفس الحقل — لا مغادرة' : 'Translation in the same field — no leaving'}
          </p>
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

      <div className="flex justify-center gap-1.5 mt-4">
        {translationDemos.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === demoIndex ? 'w-6 bg-primary-500' : 'w-1.5 bg-secondary-300 dark:bg-secondary-700'}`} />
        ))}
      </div>
    </div>
  );
}
