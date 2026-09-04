import { Link } from 'react-router-dom';
import { Mail, ArrowRight, Check } from 'lucide-react';
import Logo from '@/bolt/components/layout/Logo';

export default function ForgotPassword() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-xl shadow-slate-200/30">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Forgot your password?</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Enter your email and we will send you a link to reset your password.</p>

          <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
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
            <button type="submit" className="btn-primary w-full">
              Send reset link
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-5 flex items-start gap-2.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 p-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400" />
            <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
              If the email exists, a reset link will arrive within a few minutes. Check your spam folder if you do not see it.
            </p>
          </div>
        </div>
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          Remembered your password? <Link to="/account" className="font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:text-sky-400">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
