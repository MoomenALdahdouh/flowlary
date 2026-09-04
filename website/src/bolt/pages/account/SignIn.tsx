import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Chrome, ArrowRight, Eye, EyeOff } from 'lucide-react';
import Logo from '@/bolt/components/layout/Logo';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-xl shadow-slate-200/30">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{footer}</div>
      </div>
    </div>
  );
}

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access Writing Lab, progress, and your dashboard."
      footer={<>New to Flowlary? <Link to="/account?mode=register" className="font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:text-sky-400">Create an account</Link></>}
    >
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Email</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-slate-400 dark:text-slate-500">Password</label>
            <Link to="/account/forgot-password" className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:text-sky-400">Forgot?</Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Your password"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 py-3 pl-10 pr-10 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:text-slate-500"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          Sign in
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
        <span className="text-xs text-slate-400 dark:text-slate-500">or</span>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
      </div>
      <Link to="/guide" className="btn-secondary w-full">
        <Chrome className="h-4 w-4" />
        Install the extension instead
      </Link>
    </AuthShell>
  );
}
