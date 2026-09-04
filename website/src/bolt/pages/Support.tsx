import { useState } from 'react';
import { Search, ChevronRight, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '@/bolt/components/ui/PageHeader';
import CTASection from '@/bolt/components/ui/CTASection';
import { SUPPORT_ARTICLES } from '@/bolt/data/site';

const CATEGORIES = [...new Set(SUPPORT_ARTICLES.map((a) => a.category))];

export default function Support() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = SUPPORT_ARTICLES.filter((article) => {
    const matchesQuery = article.title.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !activeCategory || article.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <>
        <PageHeader
          label="Support"
          title="How can we help?"
          subtitle="Search our help articles or browse by category. If you cannot find what you need, contact us directly."
          breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Support' }]}
        />

        <section className="fl-section">
          <div className="container-flow">
            {/* Search */}
            <div className="mx-auto max-w-2xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for help..."
                  className="w-full rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 py-4 pl-12 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
              <button
                onClick={() => setActiveCategory(null)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  !activeCategory ? 'bg-slate-900 dark:bg-slate-950 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                    activeCategory === cat ? 'bg-slate-900 dark:bg-slate-950 text-white' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:bg-slate-900 dark:bg-slate-950'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="mx-auto mt-12 max-w-2xl space-y-2">
              {filtered.length === 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">No articles found. Try a different search or contact us.</p>
                  <Link to="/contact" className="mt-3 inline-block text-sm font-semibold text-sky-600 dark:text-sky-400">
                    Contact support
                  </Link>
                </div>
              )}
              {filtered.map((article, i) => (
                <Link
                  key={i}
                  to={article.to}
                  className="group flex items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-4 transition-all hover:border-sky-200 dark:hover:border-sky-500/50 hover:shadow-md"
                >
                  <FileText className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{article.title}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{article.category}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 dark:text-slate-600 transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>

            {/* Contact links */}
            <div className="mx-auto mt-16 max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-8 text-center">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Still need help?</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-500">Our team responds within one business day.</p>
              <div className="mt-4 flex justify-center gap-3">
                <Link to="/contact" className="btn-primary text-xs">Contact us</Link>
                <Link to="/feedback" className="btn-secondary text-xs">Send feedback</Link>
              </div>
            </div>
          </div>
        </section>

        <CTASection />
      </>
  );
}
