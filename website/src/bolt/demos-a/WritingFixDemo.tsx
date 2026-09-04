import { useState, useEffect, useCallback } from 'react';
import { PenLine, Check, RotateCcw, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '@/shared/AppContext';
import { writingDemos } from '@/shared/demos';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Card';

export function WritingFixDemo({ autoPlay = true, compact = false }: { autoPlay?: boolean; compact?: boolean }) {
  const { lang } = useApp();
  const [demoIndex, setDemoIndex] = useState(0);
  const [phase, setPhase] = useState<'showing' | 'analyzing' | 'reviewing' | 'applied'>('showing');
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());
  const demo = writingDemos[demoIndex];

  const reset = useCallback(() => {
    setPhase('showing');
    setAppliedSuggestions(new Set());
  }, []);

  const next = useCallback(() => {
    setDemoIndex(i => (i + 1) % writingDemos.length);
    reset();
  }, [reset]);

  useEffect(() => {
    if (phase === 'showing') {
      const timer = setTimeout(() => setPhase('analyzing'), 800);
      return () => clearTimeout(timer);
    } else if (phase === 'analyzing') {
      const timer = setTimeout(() => setPhase('reviewing'), 1000);
      return () => clearTimeout(timer);
    } else if (phase === 'reviewing' && autoPlay) {
      const timer = setTimeout(() => {
        setAppliedSuggestions(new Set(demo.suggestions.map((_, i) => i)));
        setPhase('applied');
      }, 2000);
      return () => clearTimeout(timer);
    } else if (phase === 'applied' && autoPlay) {
      const timer = setTimeout(() => next(), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase, autoPlay, demo.suggestions, next]);

  const renderText = () => {
    if (phase === 'showing' || phase === 'analyzing') {
      return <span className="text-secondary-900 dark:text-secondary-100">{demo.before}</span>;
    }

    const words = demo.before.split(' ');
    let result: React.ReactNode[] = [];
    let wordIdx = 0;

    demo.suggestions.forEach((sug, sugIdx) => {
      const beforeWords = sug.original.split(' ');
      while (wordIdx < words.length && !beforeWords.includes(words[wordIdx].replace(/[.,;!?]/g, ''))) {
        result.push(<span key={`w-${wordIdx}`}>{words[wordIdx]} </span>);
        wordIdx++;
      }
      const isApplied = appliedSuggestions.has(sugIdx);
      beforeWords.forEach((bw) => {
        const actualWord = words.find((w, i) => i >= wordIdx && w.replace(/[.,;!?]/g, '') === bw);
        if (actualWord) {
          wordIdx = words.indexOf(actualWord) + 1;
        }
        result.push(
          <span key={`s-${sugIdx}-${bw}`} className={`transition-all duration-300 inline-block ${
            isApplied
              ? 'text-success-600 dark:text-success-400 font-medium'
              : phase === 'reviewing'
                ? 'text-error-600 dark:text-error-400 underline decoration-wavy decoration-error-400 bg-error-50 dark:bg-error-900/20 px-0.5 rounded'
                : ''
          }`}>
            {isApplied ? sug.replacement : actualWord || bw}{' '}
          </span>
        );
      });
    });

    while (wordIdx < words.length) {
      result.push(<span key={`w-${wordIdx}`}>{words[wordIdx]} </span>);
      wordIdx++;
    }

    return result;
  };

  return (
    <div className={`card-surface p-6 ${compact ? '' : 'sm:p-8'} overflow-hidden`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            <PenLine className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
            {lang === 'ar' ? 'إصلاح الكتابة' : 'Fix Writing'}
          </span>
        </div>
        {phase === 'analyzing' && (
          <Badge variant="primary">
            <Sparkles className="w-3 h-3 animate-pulse-soft" />
            {lang === 'ar' ? 'تحليل…' : 'Analyzing…'}
          </Badge>
        )}
        {phase === 'applied' && (
          <Badge variant="success">
            <Check className="w-3 h-3" />
            {lang === 'ar' ? 'تم التطبيق' : 'Applied'}
          </Badge>
        )}
      </div>

      {/* Text area */}
      <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 px-4 py-3 min-h-[80px]">
        <p className="text-base leading-relaxed">{renderText()}</p>
      </div>

      {/* Suggestions */}
      {(phase === 'reviewing' || phase === 'applied') && (
        <div className="mt-4 space-y-2 animate-fade-in-up">
          <p className="text-xs font-medium text-secondary-500 mb-2">
            {lang === 'ar' ? 'الاقتراحات — راجع ثم طبّق' : 'Suggestions — review then apply'}
          </p>
          {demo.suggestions.map((sug, i) => {
            const applied = appliedSuggestions.has(i);
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-300 ${
                applied
                  ? 'border-success-200 dark:border-success-800 bg-success-50 dark:bg-success-900/20'
                  : 'border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800/50'
              }`}>
                <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  applied ? 'bg-success-500' : 'bg-primary-100 dark:bg-primary-900/40'
                }`}>
                  {applied ? <Check className="w-3 h-3 text-white" /> : <AlertCircle className="w-3 h-3 text-primary-600 dark:text-primary-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-error-600 dark:text-error-400 line-through">{sug.original}</span>
                    <span className="text-secondary-400">→</span>
                    <span className="text-sm font-medium text-success-600 dark:text-success-400">{sug.replacement}</span>
                    <Badge variant={sug.type === 'spelling' ? 'accent' : sug.type === 'grammar' ? 'primary' : 'default'} className="text-[10px]">
                      {sug.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-secondary-500 mt-1">{sug.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!compact && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-secondary-500">
            {lang === 'ar' ? 'فحص كتابة واحد = تحليل واحد، حتى لو ظهرت عدة اقتراحات' : 'One writing check = one analysis, even if several suggestions appear'}
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
        {writingDemos.map((_, i) => (
          <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === demoIndex ? 'w-6 bg-primary-500' : 'w-1.5 bg-secondary-300 dark:bg-secondary-700'}`} />
        ))}
      </div>
    </div>
  );
}
