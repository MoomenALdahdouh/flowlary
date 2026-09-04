import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export default function PageHeader({
  label,
  title,
  subtitle,
  breadcrumbs,
  meta,
}: {
  label?: string;
  title: ReactNode;
  subtitle?: string;
  breadcrumbs?: { label: string; to?: string }[];
  meta?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white dark:border-slate-700 dark:from-slate-900 dark:to-slate-950">
      <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="container-flow relative py-14 sm:py-16 lg:py-24 animate-fade-up">
        {breadcrumbs && (
          <div className="mb-5">
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  {crumb.to ? (
                    <Link to={crumb.to} className="transition-colors hover:text-sky-600 dark:hover:text-sky-400">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-slate-700 dark:text-slate-200">{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 rtl:rotate-180 dark:text-slate-600" />
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
        {label && (
          <span className="section-label">{label}</span>
        )}
        <h1 className="text-balance text-[1.75rem] font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-2xl text-balance text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        )}
        {meta ? <div className="mt-6">{meta}</div> : null}
      </div>
    </section>
  );
}
