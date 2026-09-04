import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useApp } from '@/shared/AppContext';
import { Button } from '@/shared/ui/Button';
import { Toggle } from '@/shared/ui/Card';

const liveDemoSteps = [
  { ar: 'م', en: '' },
  { ar: 'مر', en: '' },
  { ar: 'مرح', en: '' },
  { ar: 'مرحب', en: 'hel' },
  { ar: 'مرحبا', en: 'hello' },
  { ar: 'مرحباً،', en: 'hello,' },
  { ar: 'مرحباً، ك', en: 'hello, I' },
  { ar: 'مرحباً، كي', en: 'hello, I am' },
  { ar: 'مرحباً، كيف', en: 'hello, how are' },
  { ar: 'مرحباً، كيف ح', en: 'hello, how are you' },
  { ar: 'مرحباً، كيف حالك؟', en: 'hello, how are you?' },
];

export function LiveTranslationDemo({ autoPlay = true }: { autoPlay?: boolean }) {
  const { lang } = useApp();
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState(0);
  const [arText, setArText] = useState('');
  const [enText, setEnText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const reset = useCallback(() => {
    setStep(0);
    setArText('');
    setEnText('');
  }, []);

  useEffect(() => {
    if (enabled && autoPlay) {
      if (step < liveDemoSteps.length) {
        timerRef.current = setTimeout(() => {
          setArText(liveDemoSteps[step].ar);
          setEnText(liveDemoSteps[step].en);
          setStep(s => s + 1);
        }, 300);
      } else {
        timerRef.current = setTimeout(() => reset(), 2500);
      }
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [enabled, step, autoPlay, reset]);

  useEffect(() => {
    if (enabled) reset();
  }, [enabled, reset]);

  return (
    <div className="card-surface p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
            {enabled ? <Eye className="w-4 h-4 text-primary-600 dark:text-primary-400" /> : <EyeOff className="w-4 h-4 text-secondary-400" />}
          </div>
          <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">
            {lang === 'ar' ? 'الترجمة المباشرة' : 'Live Translation'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-500">{enabled ? (lang === 'ar' ? 'مفعّلة' : 'On') : (lang === 'ar' ? 'معطّلة' : 'Off')}</span>
          <Toggle checked={enabled} onChange={setEnabled} />
        </div>
      </div>

      <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 p-4 min-h-[120px]">
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-secondary-500 block mb-1">العربية</span>
            <p dir="rtl" className="text-lg font-arabic text-secondary-900 dark:text-secondary-100 min-h-[28px]">
              {arText}
              {enabled && step < liveDemoSteps.length && <span className="cursor-blink" />}
            </p>
          </div>
          <div className="h-px bg-secondary-200 dark:bg-secondary-700" />
          <div>
            <span className="text-xs font-medium text-secondary-500 block mb-1">English</span>
            <p dir="ltr" className={`text-lg min-h-[28px] transition-all duration-300 ${enabled ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-400'}`}>
              {enabled ? enText || (lang === 'ar' ? '…' : '…') : (lang === 'ar' ? 'معطّلة — اضغط للتشغيل' : 'Off — toggle to enable')}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={reset}>
          {lang === 'ar' ? 'إعادة' : 'Replay'}
        </Button>
        <p className="text-xs text-secondary-500">
          {lang === 'ar' ? 'مطفأ افتراضياً — تشغّله فقط حين تريد' : 'Off by default — you turn it on only when you want'}
        </p>
      </div>
    </div>
  );
}
