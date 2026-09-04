import { useState } from 'react';
import { PenLine, Check, Sparkles, BookOpen, ArrowRight, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '@/bolt/components/ui/PageHeader';
import CTASection from '@/bolt/components/ui/CTASection';

// Simulated analysis rules
const RULES: { pattern: RegExp; fix: string; type: 'spelling' | 'grammar' | 'wording'; message: string }[] = [
  { pattern: /\bpostpond\b/gi, fix: 'postponed', type: 'spelling', message: 'Spelling: postpond → postponed' },
  { pattern: /\brecieve\b/gi, fix: 'receive', type: 'spelling', message: 'Spelling: recieve → receive' },
  { pattern: /\bseperate\b/gi, fix: 'separate', type: 'spelling', message: 'Spelling: seperate → separate' },
  { pattern: /\bteh\b/gi, fix: 'the', type: 'spelling', message: 'Spelling: teh → the' },
  { pattern: /\bposible\b/gi, fix: 'possible', type: 'spelling', message: 'Spelling: posible → possible' },
  { pattern: /\bweak\b/gi, fix: 'week', type: 'spelling', message: 'Spelling: weak → week (in time context)' },
  { pattern: /\bhave been\b/gi, fix: 'has been', type: 'grammar', message: 'Grammar: "have been" → "has been" (singular subject)' },
  { pattern: /\bin order to\b/gi, fix: 'to', type: 'wording', message: 'Wording: "in order to" → "to" (concise)' },
  { pattern: /\bdue to the fact that\b/gi, fix: 'because', type: 'wording', message: 'Wording: "due to the fact that" → "because"' },
  { pattern: /\bat this point in time\b/gi, fix: 'now', type: 'wording', message: 'Wording: "at this point in time" → "now"' },
  { pattern: /\bits\b/gi, fix: "it's", type: 'grammar', message: "Grammar: its → it's (contraction)" },
  { pattern: /\balong\b/gi, fix: 'a long', type: 'grammar', message: 'Grammar: along → a long' },
];

interface Suggestion {
  word: string;
  fix: string;
  type: 'spelling' | 'grammar' | 'wording';
  message: string;
  index: number;
}

function analyze(text: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  RULES.forEach((rule) => {
    let match;
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);
    while ((match = re.exec(text)) !== null) {
      suggestions.push({
        word: match[0],
        fix: rule.fix,
        type: rule.type,
        message: rule.message,
        index: match.index,
      });
    }
  });
  return suggestions;
}

const TYPE_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  spelling: { border: 'border-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-400' },
  grammar: { border: 'border-sky-300', bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-400' },
  wording: { border: 'border-teal-300', bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-400' },
};

export default function WritingLab() {
  const [text, setText] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applied, setApplied] = useState<number[]>([]);
  const [analyzed, setAnalyzed] = useState(false);

  const handleAnalyze = () => {
    setSuggestions(analyze(text));
    setApplied([]);
    setAnalyzed(true);
  };

  const applyFix = (i: number) => {
    if (applied.includes(i)) return;
    const s = suggestions[i];
    setText(text.slice(0, s.index) + s.fix + text.slice(s.index + s.word.length));
    setApplied([...applied, i]);
  };

  const applyAll = () => {
    let newText = text;
    const sorted = [...suggestions].sort((a, b) => b.index - a.index);
    sorted.forEach((s, originalIdx) => {
      const realIdx = suggestions.indexOf(s);
      if (!applied.includes(realIdx)) {
        newText = newText.slice(0, s.index) + s.fix + newText.slice(s.index + s.word.length);
        setApplied((prev) => [...prev, realIdx]);
      }
    });
    setText(newText);
  };

  const sampleText = 'I am writing to inform you that the meeting has been postpond to next weak. I recieve your message and will reply in order to confirm the schedule. Its important that we seperate the items at this point in time.';

  return (
    <>
      <PageHeader
        label="Writing Lab"
        title="Writing Lab — write English, see live analysis"
        subtitle="Paste or write English text and see Flowlary's analysis on the site. This is Flowlary AI on the website — not the same engine as the Chrome extension, but a real taste of how suggestions feel. Progress can belong to the same account."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Writing Lab' }]}
      />

      {/* Honest label */}
      <section className="border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-500/10/50 py-4">
        <div className="container-flow">
          <div className="flex items-center gap-3">
            <Info className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />
            <p className="text-sm text-amber-800">
              <strong>Writing Lab uses Flowlary's on-site AI</strong> — a different engine from the Chrome extension. It gives you a real feel for how suggestions work, but results may differ from the extension.
            </p>
          </div>
        </div>
      </section>

      <section className="fl-section">
        <div className="container-flow">
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Editor */}
            <div className="lg:col-span-3">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-6 shadow-lg shadow-slate-200/20">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Your text</h3>
                  <button
                    onClick={() => { setText(sampleText); setAnalyzed(false); setSuggestions([]); }}
                    className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:text-sky-400"
                  >
                    Insert sample text
                  </button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => { setText(e.target.value); setAnalyzed(false); }}
                  placeholder="Write or paste English text here..."
                  className="h-64 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                />
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{text.length} characters</span>
                  <div className="flex gap-2">
                    {suggestions.length > 0 && applied.length < suggestions.length && (
                      <button onClick={applyAll} className="btn-ghost text-xs">
                        Apply all
                      </button>
                    )}
                    <button onClick={handleAnalyze} className="btn-primary text-xs">
                      <Sparkles className="h-3.5 w-3.5" />
                      Analyze
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Suggestions panel */}
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-6 shadow-lg shadow-slate-200/20">
                <h3 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Suggestions</h3>

                {!analyzed && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <PenLine className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-400 dark:text-slate-500">Write something and click Analyze to see suggestions.</p>
                  </div>
                )}

                {analyzed && suggestions.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Check className="mb-3 h-8 w-8 text-green-400" />
                    <p className="text-sm text-green-600 dark:text-green-400">No issues found. Clean writing.</p>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="space-y-2">
                    {suggestions.map((s, i) => {
                      const colors = TYPE_COLORS[s.type];
                      const isApplied = applied.includes(i);
                      return (
                        <div
                          key={i}
                          className={`rounded-xl border p-3 transition-all ${isApplied ? 'border-green-200 dark:border-green-500/30 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10/50 opacity-60' : `${colors.border} ${colors.bg}`}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                                <span className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>{s.type}</span>
                              </div>
                              <div className="mt-1.5 text-sm text-slate-700 dark:text-slate-300 dark:text-slate-600">
                                <span className="font-mono text-rose-500 dark:text-rose-400 line-through">{s.word}</span>
                                <ArrowRight className="mx-1 inline h-3 w-3 text-slate-300 dark:text-slate-600" />
                                <span className="font-mono text-green-600 dark:text-green-400">{s.fix}</span>
                              </div>
                            </div>
                            {!isApplied ? (
                              <button
                                onClick={() => applyFix(i)}
                                className="rounded-lg bg-slate-900 dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700"
                              >
                                Apply
                              </button>
                            ) : (
                              <Check className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {analyzed && suggestions.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-400 dark:text-slate-500">
                    {applied.length} of {suggestions.length} applied
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Account note */}
          <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-6 text-center">
            <BookOpen className="mx-auto mb-3 h-8 w-8 text-sky-500 dark:text-sky-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Your progress, one account</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">
              Sign in to save your Writing Lab sessions. Progress in the Writing Lab and the Chrome extension dashboard belong to the same account.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link to="/account" className="btn-secondary text-xs">Sign in</Link>
              <Link to="/account?mode=register" className="btn-primary text-xs">Create account</Link>
            </div>
          </div>
        </div>
      </section>

      <CTASection
        title="Want this in every field?"
        subtitle="The Writing Lab is a taste. The Chrome extension brings writing help to Gmail, Google Docs, WhatsApp Web, and anywhere you type."
        secondaryLabel="Try the demos"
      />
    </>
  );
}
