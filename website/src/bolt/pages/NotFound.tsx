import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useMessages } from '../../i18n/index.tsx'

export default function NotFound() {
  const t = useMessages()
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 px-5 text-center">
      <div className="bg-gradient-to-b from-sky-500 to-teal-500 bg-clip-text text-8xl font-extrabold text-transparent">404</div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.pages.notFound.title}</h1>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{t.pages.notFound.lead}</p>
      <Link to="/" className="btn-primary">
        <Home className="h-4 w-4" />
        {t.pages.notFound.back}
      </Link>
    </div>
  )
}
