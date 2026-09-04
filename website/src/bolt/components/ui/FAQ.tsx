import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useMessages } from '../../../i18n/index.tsx'

export interface FAQItem {
  q: string
  a: string
}

export default function FAQ({ items, title }: { items: FAQItem[]; title?: string }) {
  const t = useMessages()
  const heading = title ?? t.pages.faqTitle
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="mb-8 text-center text-3xl font-bold text-slate-900 dark:text-white">{heading}</h2>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-xl border transition-colors ${
              open === i ? 'border-sky-200 bg-sky-50/40 dark:border-sky-500/30 dark:bg-sky-500/5' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start"
              aria-expanded={open === i}
            >
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300 dark:text-slate-500 ${
                  open === i ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ${
                open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
