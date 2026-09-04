import { useState, useCallback } from 'react';
import { Zap, Copy, Check, X, ArrowRight } from 'lucide-react';
import { useApp } from '@/shared/AppContext';
import { speedBoxDemos } from '@/shared/demos';
import { Button } from '@/shared/ui/Button';

type Mode = 'layout' | 'translate' | 'fix';

export function SpeedBoxDemo() {
  const { lang } = useApp();
  const [mode, setMode] = useState<Mode>('layout');
  const [input, setInput] = useState(speedBoxDemos[0].input);
  const [output, setOutput] = useState(speedBoxDemos[0].output);
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  const modes: { id: Mode; label: string; labelAr: string; icon: React.ReactNode }[] = [
    { id: 'layout', label: 'Layout', labelAr: 'تخطيط', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'translate', label: 'Translate', labelAr: 'ترجمة', icon: <ArrowRight className="w-3.5 h-3.5" /> },
    { id: 'fix', label: 'Fix', labelAr: 'إصلاح', icon: <Check className="w-3.5 h-3.5" /> },
  ];

  const handleModeChange = useCallback((m: Mode) => {
    setMode(m);
    setApplied(false);
    setCopied(false);
    const demo = speedBoxDemos.find(d => d.mode === m);
    if (demo) {
      setInput(demo.input);
      setOutput(demo.output);
    } else {
      setInput('');
      setOutput('');
    }
  }, []);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="relative">
      {/* Dimmed page background */}
      <div className="rounded-2xl bg-secondary-100 dark:bg-secondary-900 overflow-hidden relative">
        {/* Fake page content */}
        <div className="p-8 opacity-40 select-none">
          <div className="h-4 w-32 bg-secondary-300 dark:bg-secondary-700 rounded mb-3" />
          <div className="h-3 w-full bg-secondary-200 dark:bg-secondary-800 rounded mb-2" />
          <div className="h-3 w-5/6 bg-secondary-200 dark:bg-secondary-800 rounded mb-2" />
          <div className="h-3 w-3/4 bg-secondary-200 dark:bg-secondary-800 rounded mb-4" />
          <div className="h-3 w-2/3 bg-secondary-200 dark:bg-secondary-800 rounded" />
        </div>

        {/* Speed Box overlay */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong rounded-2xl shadow-2xl animate-scale-in overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 dark:border-secondary-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-secondary-900 dark:text-secondary-50">Speed Box</span>
              </div>
              <button className="p-1 rounded hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors">
                <X className="w-4 h-4 text-secondary-500" />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 p-2">
              {modes.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleModeChange(m.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                    mode === m.id
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                  }`}
                >
                  {m.icon}
                  {lang === 'ar' ? m.labelAr : m.label}
                </button>
              ))}
            </div>

            {/* Input/Output */}
            <div className="px-3 pb-3 space-y-2">
              <div>
                <label className="text-[10px] font-medium text-secondary-500 px-1">
                  {lang === 'ar' ? 'الإدخال' : 'Input'}
                </label>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full rounded-lg bg-secondary-50 dark:bg-secondary-800/50 border border-secondary-200 dark:border-secondary-700 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-secondary-500 px-1 flex items-center gap-1">
                  {mode === 'layout' && <span className="text-[10px] text-primary-600">{lang === 'ar' ? 'مجاني · لا فحصات' : 'Free · no checks'}</span>}
                  {(mode === 'translate' || mode === 'fix') && <span className="text-[10px] text-accent-600">{lang === 'ar' ? 'فحص واحد' : '1 check'}</span>}
                </label>
                <div className="w-full rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 px-3 py-2 text-sm font-mono text-primary-700 dark:text-primary-300 min-h-[38px]">
                  {output}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-3 pb-3">
              <Button
                variant={applied ? 'success' : 'primary'}
                size="sm"
                fullWidth
                onClick={handleApply}
                leftIcon={applied ? <Check className="w-3.5 h-3.5" /> : undefined}
                className={applied ? 'bg-success-500 hover:bg-success-500' : ''}
              >
                {applied ? (lang === 'ar' ? 'تم التطبيق' : 'Applied') : (lang === 'ar' ? 'تطبيق' : 'Apply')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                leftIcon={copied ? <Check className="w-3.5 h-3.5 text-success-500" /> : <Copy className="w-3.5 h-3.5" />}
              >
                {copied ? (lang === 'ar' ? 'تم النسخ' : 'Copied') : (lang === 'ar' ? 'نسخ' : 'Copy')}
              </Button>
            </div>

            <div className="px-3 pb-3 -mt-1">
              <p className="text-[10px] text-secondary-400 text-center">
                {lang === 'ar' ? 'Esc للإغلاق · يعمل بدون فحصات للإصلاح' : 'Esc to close · layout works without checks'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
