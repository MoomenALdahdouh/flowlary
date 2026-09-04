import { Link } from 'react-router-dom';
import { MailCheck, ArrowRight, Check } from 'lucide-react';
import Logo from '@/bolt/components/layout/Logo';

export default function VerifyEmail() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Logo className="justify-center" />
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:bg-slate-950 p-8 shadow-xl shadow-slate-200/30">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-500/10">
            <MailCheck className="h-8 w-8 text-sky-500 dark:text-sky-400" />
          </div>
          <h1 className="text-center text-2xl font-bold text-slate-900 dark:text-white">Check your email</h1>
          <p className="mt-3 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
            We sent a verification link to your email address. Click the link to confirm your account and start using Flowlary.
          </p>

          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 dark:bg-slate-950 p-4">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400" />
              <p className="text-xs text-slate-600 dark:text-slate-400 dark:text-slate-500">
                The link expires in 24 hours. If you do not see the email, check your spam folder.
              </p>
            </div>
            <button className="btn-primary w-full">
              Resend verification email
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          Already verified? <Link to="/account" className="font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:text-sky-400">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
