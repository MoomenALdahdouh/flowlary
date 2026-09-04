import { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, Check, Lightbulb, Bug, MessageSquare } from 'lucide-react';
import PageHeader from '@/bolt/components/ui/PageHeader';

const FEEDBACK_TYPES = [
  { id: 'idea', label: 'Feature idea', icon: Lightbulb, color: 'text-amber-500 dark:text-amber-400' },
  { id: 'bug', label: 'Report a bug', icon: Bug, color: 'text-rose-500 dark:text-rose-400' },
  { id: 'general', label: 'General feedback', icon: MessageSquare, color: 'text-sky-500 dark:text-sky-400' },
];

export default function Feedback() {
  const [type, setType] = useState('idea');
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <PageHeader
        label="Feedback"
        title="Tell us what you think"
        subtitle="Ideas, ratings, bug reports — we read all of it. Flowlary gets better because people like you tell us what works and what does not."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Feedback' }]}
      />

      <section className="fl-section">
        <div className="container-flow">
          <div className="mx-auto max-w-2xl">
            {submitted ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-green-200 dark:border-green-500/30 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10/50 p-12 text-center">
                <Check className="mb-4 h-12 w-12 text-green-500" />
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Thank you</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">
                  Your feedback helps us make Flowlary better for every bilingual writer.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setRating(0); setMessage(''); }}
                  className="btn-secondary mt-6"
                >
                  Send more feedback
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8">
                {/* Type */}
                <div>
                  <label className="mb-3 block text-xs font-medium text-slate-400 dark:text-slate-500">What kind of feedback?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {FEEDBACK_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                          type === t.id
                            ? 'border-sky-300 bg-sky-50 dark:bg-sky-500/10'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950'
                        }`}
                      >
                        <t.icon className={`h-6 w-6 ${type === t.id ? 'text-sky-500 dark:text-sky-400' : t.color}`} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 dark:text-slate-600">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <label className="mb-3 block text-xs font-medium text-slate-400 dark:text-slate-500">How would you rate Flowlary?</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Your feedback</label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    placeholder={type === 'idea' ? 'What feature would you like to see?' : type === 'bug' ? 'What happened? What did you expect?' : 'Tell us anything...'}
                    className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                {/* Quick options */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: ThumbsUp, label: 'Love the keyboard repair' },
                    { icon: ThumbsDown, label: 'Wish it worked in X' },
                    { icon: Lightbulb, label: 'Add support for Y' },
                  ].map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => setMessage((prev) => prev ? `${prev}\n\n${tag.label}` : tag.label)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950"
                    >
                      <tag.icon className="h-3.5 w-3.5" />
                      {tag.label}
                    </button>
                  ))}
                </div>

                <button type="submit" className="btn-primary w-full">
                  Send feedback
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
