import { Link } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import Logo from '@/bolt/components/layout/Logo';

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-xl shadow-slate-200/30">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Set a new password</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">Choose a strong password for your Flowlary account.</p>

          <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">New password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
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
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400 dark:text-slate-500">Confirm password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 py-3 pl-10 pr-4 text-sm text-slate-800 dark:text-slate-200 outline-none transition-colors focus:border-sky-300 focus:bg-white dark:bg-slate-900 dark:bg-slate-950 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">
              Reset password
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          <Link to="/account" className="font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:text-sky-400">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
