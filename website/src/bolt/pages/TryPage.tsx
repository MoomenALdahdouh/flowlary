import { useState } from 'react';
import { Keyboard, Languages, PenLine, RotateCcw, Check, ArrowRight, MousePointerClick } from 'lucide-react';
import PageHeader from '@/bolt/components/ui/PageHeader';
import CTASection from '@/bolt/components/ui/CTASection';
import { FidelityBadge } from '../../components/Ui.tsx';
import { useMessages } from '../../i18n/index.tsx';

type Tab = 'keyboard' | 'english' | 'translation';

export default function TryPage() {
  const t = useMessages();
  const p = t.pages.tryPage;
  const [tab, setTab] = useState<Tab>('keyboard');

  return (
    <>
      <PageHeader
        label={p.label}
        title={
          <>
            {p.titleBefore} <span className="text-gradient xp-gradient-text">Flowlary</span> {p.titleAfter}
          </>
        }
        subtitle={p.subtitle}
        breadcrumbs={[{ label: t.pages.home, to: '/' }, { label: p.label }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          {/* Preview disclaimer */}
          <div className="mx-auto mb-8 flex max-w-3xl flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:mb-12 sm:flex-row sm:items-center sm:px-5 sm:py-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <FidelityBadge mode="simulated" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{p.previewStrong}</strong> {p.preview}
            </p>
          </div>

          <div className="fl-try-tabs mx-auto" role="tablist" aria-label={p.tabsAria}>
            {([
              { id: 'keyboard' as const, label: p.tabs.keyboard, icon: Keyboard },
              { id: 'english' as const, label: p.tabs.english, icon: PenLine },
              { id: 'translation' as const, label: p.tabs.translation, icon: Languages },
            ]).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`try-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`try-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => setTab(item.id)}
                className="fl-try-tab"
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            {tab === 'keyboard' && (
              <div role="tabpanel" id="try-panel-keyboard" aria-labelledby="try-tab-keyboard">
                <KeyboardDemo />
              </div>
            )}
            {tab === 'english' && (
              <div role="tabpanel" id="try-panel-english" aria-labelledby="try-tab-english">
                <EnglishDemo />
              </div>
            )}
            {tab === 'translation' && (
              <div role="tabpanel" id="try-panel-translation" aria-labelledby="try-tab-translation">
                <TranslationDemo />
              </div>
            )}
          </div>
        </div>
      </section>

      <CTASection
        title={p.ctaTitle}
        subtitle={p.ctaLead}
        primaryTo="/guide"
        secondaryTo="/lab"
        secondaryLabel={t.pages.writingLab}
      />
    </>
  );
}

/* ============ Keyboard Repair Demo ============ */
function KeyboardDemo() {
  const p = useMessages().pages.tryPage;
  const [input, setInput] = useState('');
  const [repaired, setRepaired] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

  // Simulate repair: map common English keys to Arabic
  const repairMap: Record<string, string> = {
    's': 'س', 'f': 'ب', 'j': 'ي', 't': 'ف', 'h': 'ا', 'l': 'ل', 'k': 'م',
    'q': 'ض', 'w': 'ص', 'e': 'ث', 'r': 'ق', 'y': 'غ', 'u': 'ع', 'i': 'ه',
    'o': 'خ', 'p': 'ح', 'a': 'ش', 'g': 'ل', 'd': 'ي', 'z': 'ء', 'x': 'س',
    'c': 'ؤ', 'v': 'ر', 'b': 'لا', 'n': 'ى', 'm': 'ة', ' ': ' ',
  };

  const handleRepair = () => {
    if (!input.trim()) {
      setShowHint(true);
      return;
    }
    setShowHint(false);
    const result = input.split('').map((c) => repairMap[c.toLowerCase()] || c).join('');
    setRepaired(result);
  };

  const reset = () => {
    setInput('');
    setRepaired(null);
    setShowHint(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-lg shadow-slate-200/30">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{p.keyboardTitle}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {p.keyboardLead}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">{p.typeHere}</label>
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setRepaired(null); }}
            placeholder={p.placeholder}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 px-4 py-3 text-lg text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={handleRepair} className="btn-primary">
            <Keyboard className="h-4 w-4" />
            {p.repair}
          </button>
          <button type="button" onClick={reset} className="btn-ghost">
            <RotateCcw className="h-4 w-4" />
            {p.reset}
          </button>
        </div>

        {showHint && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            {p.hint}
          </div>
        )}

        {repaired !== null && (
          <div className="animate-fade-up rounded-xl border border-green-200 dark:border-green-500/30 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10/50 p-5">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-green-600 dark:text-green-400">
              <Check className="h-4 w-4" />
              {p.repairedTo}
            </div>
            <div className="font-arabic text-2xl text-slate-800 dark:text-slate-200" dir="auto">{repaired || p.empty}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============ English Writing Help Demo ============ */
const ENGLISH_SENTENCES = [
  { text: 'I am writing to inform you that the meeting has been postpond to next weak.', issues: [{ word: 'postpond', fix: 'postponed', start: 48, end: 56 }, { word: 'weak', fix: 'week', start: 62, end: 66 }] },
  { text: 'She have been working on this project for along time and its almost done.', issues: [{ word: 'have', fix: 'has', start: 4, end: 8 }, { word: 'along', fix: 'a long', start: 48, end: 53 }, { word: 'its', fix: "it's", start: 58, end: 61 }] },
  { text: 'The report is due by friday and I need you to send it to me as soon as posible.', issues: [{ word: 'friday', fix: 'Friday', start: 19, end: 25 }, { word: 'posible', fix: 'possible', start: 72, end: 79 }] },
];

function EnglishDemo() {
  const p = useMessages().pages.tryPage;
  const [sentenceIdx, setSentenceIdx] = useState(0);
  const [appliedFixes, setAppliedFixes] = useState<number[]>([]);
  const sentence = ENGLISH_SENTENCES[sentenceIdx];

  const applyFix = (i: number) => {
    setAppliedFixes([...appliedFixes, i]);
  };

  const nextSentence = () => {
    setSentenceIdx((sentenceIdx + 1) % ENGLISH_SENTENCES.length);
    setAppliedFixes([]);
  };

  // Build the text with applied fixes
  let displayText = '';
  let lastEnd = 0;
  const parts: { text: string; isFixed: boolean; fixIndex?: number; original?: string; fix?: string }[] = [];
  sentence.issues.forEach((issue, i) => {
    parts.push({ text: sentence.text.slice(lastEnd, issue.start), isFixed: false });
    const isApplied = appliedFixes.includes(i);
    parts.push({ text: isApplied ? issue.fix : issue.word, isFixed: isApplied, fixIndex: i, original: issue.word, fix: issue.fix });
    lastEnd = issue.end;
  });
  parts.push({ text: sentence.text.slice(lastEnd), isFixed: false });

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-lg shadow-slate-200/30">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{p.englishTitle}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {p.englishLead}
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-5">
          <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-200">
            {parts.map((part, i) => {
              if (part.isFixed) {
                return <span key={i} className="text-slate-800 dark:text-slate-200">{part.text}</span>;
              }
              if (part.fixIndex !== undefined && !appliedFixes.includes(part.fixIndex)) {
                return (
                  <span key={i} className="group relative">
                    <button
                      type="button"
                      onClick={() => applyFix(part.fixIndex!)}
                      className="border-b-2 border-amber-400 bg-amber-50 text-slate-800 transition-colors hover:bg-amber-100 dark:bg-amber-500/10 dark:text-slate-200"
                      aria-label={`${part.original} → ${part.fix}`}
                    >
                      {part.text}
                    </button>
                    <span className="pointer-events-none absolute -top-10 start-0 z-10 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-950">
                      {part.original} → {part.fix} {p.clickToAccept}
                    </span>
                  </span>
                );
              }
              return <span key={i}>{part.text}</span>;
            })}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
            {appliedFixes.length} {p.accepted.replace('{total}', String(sentence.issues.length))}
          </div>
          <button type="button" onClick={nextSentence} className="btn-ghost">
            {p.nextSentence}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ Translation Demo ============ */
const TRANSLATION_PAIRS = [
  { ar: 'شكراً جزيلاً على مساعدتك', en: 'Thank you very much for your help' },
  { ar: 'سأرسل لك التقرير غداً صباحاً', en: 'I will send you the report tomorrow morning' },
  { ar: 'هل يمكنك تأجيل الاجتماع إلى الأسبوع القادم؟', en: 'Could you postpone the meeting to next week?' },
  { ar: 'لقد أكملت المشروع بنجاح', en: 'I have completed the project successfully' },
];

function TranslationDemo() {
  const p = useMessages().pages.tryPage;
  const [pairIdx, setPairIdx] = useState(0);
  const [direction, setDirection] = useState<'ar-en' | 'en-ar'>('ar-en');
  const [revealed, setRevealed] = useState(false);
  const pair = TRANSLATION_PAIRS[pairIdx];

  const source = direction === 'ar-en' ? pair.ar : pair.en;
  const target = direction === 'ar-en' ? pair.en : pair.ar;
  const sourceLabel = direction === 'ar-en' ? p.arabic : p.english;
  const targetLabel = direction === 'ar-en' ? p.english : p.arabic;

  const next = () => {
    setPairIdx((pairIdx + 1) % TRANSLATION_PAIRS.length);
    setRevealed(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-lg shadow-slate-200/30">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{p.translationTitle}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {p.translationLead}
        </p>
      </div>

      <div className="fl-try-subtabs mb-4" role="group" aria-label={p.translationTitle}>
        <button
          type="button"
          className="fl-try-subtab"
          aria-pressed={direction === 'ar-en'}
          onClick={() => { setDirection('ar-en'); setRevealed(false); }}
        >
          {p.arToEn}
        </button>
        <button
          type="button"
          className="fl-try-subtab"
          aria-pressed={direction === 'en-ar'}
          onClick={() => { setDirection('en-ar'); setRevealed(false); }}
        >
          {p.enToAr}
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{sourceLabel}</div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-4 text-lg text-slate-800 dark:text-slate-200" dir="auto">
            {source}
          </div>
        </div>

        <button type="button" onClick={() => setRevealed(true)} className="btn-primary">
          <Languages className="h-4 w-4" />
          {p.translate}
        </button>

        {revealed && (
          <div className="animate-fade-up">
            <div className="mb-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">{targetLabel}</div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10/50 p-4 text-lg text-slate-800 dark:text-slate-200" dir="auto">
              {target}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={next} className="btn-ghost">
            <MousePointerClick className="h-4 w-4" />
            {p.nextExample}
          </button>
        </div>
      </div>
    </div>
  );
}
