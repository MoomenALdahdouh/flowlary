import { Link } from 'react-router-dom'
import { ChromeIcon } from '../icons/ChromeIcon'
import { Logo as BrandMark } from '../../../components/Logo.tsx'
import { useMessages } from '../../../i18n/index.tsx'

export default function Logo({ className = '', showText = true }: { className?: string; showText?: boolean }) {
  const t = useMessages()
  return (
    <Link to="/" className={`group flex items-center gap-2.5 ${className}`} aria-label={t.brand.name}>
      <BrandMark className="h-9 w-9" />
      {showText && (
        <span className="hidden text-lg font-bold tracking-tight text-slate-900 min-[360px]:inline dark:text-white">
          Flowlary
        </span>
      )}
    </Link>
  )
}

export function ChromeInstallButton({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'px-4 py-2 text-xs' : 'px-6 py-3 text-sm'
  return (
    <Link
      to="/guide"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 ${sizeClasses} font-semibold text-white shadow-lg shadow-sky-500/20 transition-all duration-300 hover:bg-sky-600 hover:shadow-xl hover:shadow-sky-500/30 active:scale-[0.97] ${className}`}
    >
      <ChromeIcon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      Add to Chrome
    </Link>
  )
}
