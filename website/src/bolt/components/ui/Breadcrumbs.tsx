import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {item.to ? (
            <Link to={item.to} className="transition-colors hover:text-sky-600 dark:hover:text-sky-400">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-700 dark:text-slate-200">{item.label}</span>
          )}
          {i < items.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />}
        </span>
      ))}
    </nav>
  );
}
