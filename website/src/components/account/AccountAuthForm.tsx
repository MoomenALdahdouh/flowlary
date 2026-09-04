import { Link } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { Button } from '../Ui.tsx'
import { ChromeIcon } from '../../bolt/components/icons/ChromeIcon'
import type { AccountClientError } from '../../account/client.ts'
import { accountAuthHref } from '../../account/authHref.ts'
import { useMessages } from '../../i18n/index.tsx'

type AccountCopy = ReturnType<typeof import('../../i18n/index.tsx').useMessages>['account']

type AccountAuthFormProps = {
  copy: AccountCopy
  authMode: 'login' | 'register'
  search: URLSearchParams
  email: string
  password: string
  confirmPassword: string
  showPassword: boolean
  showConfirmPassword: boolean
  termsAccepted: boolean
  fieldError: 'email' | 'password' | 'confirmPassword' | 'terms' | null
  error: AccountClientError | null
  errorMessage: string | null
  busy: 'login' | 'register' | null
  inputsDisabled: boolean
  submitDisabled: boolean
  retryable: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onToggleConfirmPassword: () => void
  onTermsChange: (value: boolean) => void
  onSubmit: () => void
  onRetry: () => void
}

function fieldClass(invalid: boolean) {
  return `field-input ${invalid ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-100' : ''}`
}

export function AccountAuthForm({
  copy,
  authMode,
  search,
  email,
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  termsAccepted,
  fieldError,
  error,
  errorMessage,
  busy,
  inputsDisabled,
  submitDisabled,
  retryable,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onTermsChange,
  onSubmit,
  onRetry,
}: AccountAuthFormProps) {
  const nav = useMessages().nav
  const loginTo = accountAuthHref('login', search)
  const registerTo = accountAuthHref('register', search)
  const mismatch = authMode === 'register' && confirmPassword.length > 0 && password !== confirmPassword
  const passwordOk = authMode === 'register' && password.length >= 8
  const needsTerms = authMode === 'register' && !termsAccepted && !inputsDisabled

  return (
    <>
      <div
        className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-900"
        role="tablist"
        aria-label={copy.kicker}
      >
        <Link
          to={loginTo}
          role="tab"
          aria-selected={authMode === 'login'}
          className={`rounded-full px-3 py-2 text-center text-sm font-semibold transition-colors ${
            authMode === 'login'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-sky-200 dark:bg-slate-800 dark:text-white dark:ring-sky-500/40'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          {copy.signIn}
        </Link>
        <Link
          to={registerTo}
          role="tab"
          aria-selected={authMode === 'register'}
          className={`rounded-full px-3 py-2 text-center text-sm font-semibold transition-colors ${
            authMode === 'register'
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-sky-200 dark:bg-slate-800 dark:text-white dark:ring-sky-500/40'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          {copy.createAccount}
        </Link>
      </div>

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <label className="block" htmlFor="ac-email">
          <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{copy.email}</span>
          <span className="relative block">
            <Mail className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="ac-email"
              className={`${fieldClass(fieldError === 'email')} ps-10`}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              placeholder={copy.emailPlaceholder}
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
              aria-invalid={fieldError === 'email' || undefined}
              aria-describedby={error ? 'ac-auth-error' : undefined}
              disabled={inputsDisabled}
            />
          </span>
        </label>

        <label className="block" htmlFor="ac-password">
          <span className="mb-1.5 flex items-center justify-between gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
            <span>{copy.password}</span>
            {authMode === 'login' ? (
              <Link className="font-semibold text-sky-600 hover:underline dark:text-sky-400" to="/account/forgot-password">
                {copy.forgotPassword}
              </Link>
            ) : null}
          </span>
          <span className="relative block">
            <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="ac-password"
              className={`${fieldClass(fieldError === 'password')} ps-10 pe-11`}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              placeholder={authMode === 'register' ? undefined : copy.passwordSignInPlaceholder}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              minLength={8}
              required
              aria-invalid={fieldError === 'password' || undefined}
              aria-describedby={authMode === 'register' ? 'ac-password-hint' : error ? 'ac-auth-error' : undefined}
              disabled={inputsDisabled}
            />
            <button
              type="button"
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-pressed={showPassword}
              aria-controls="ac-password"
              aria-label={showPassword ? copy.hidePassword : copy.showPassword}
              onClick={onTogglePassword}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="visually-hidden">{showPassword ? copy.hidePassword : copy.showPassword}</span>
            </button>
          </span>
          {authMode === 'register' ? (
            <p id="ac-password-hint" className={`mt-1.5 text-xs ${passwordOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
              {copy.passwordHint}
            </p>
          ) : null}
        </label>

        {authMode === 'register' ? (
          <label className="block" htmlFor="ac-confirm-password">
            <span className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">{copy.confirmPassword}</span>
            <span className="relative block">
              <Lock className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                id="ac-confirm-password"
                className={`${fieldClass(fieldError === 'confirmPassword' || mismatch)} ps-10 pe-11`}
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirm-password"
                autoComplete="new-password"
                placeholder={copy.confirmPasswordPlaceholder}
                value={confirmPassword}
                onChange={(event) => onConfirmPasswordChange(event.target.value)}
                minLength={8}
                required
                aria-invalid={fieldError === 'confirmPassword' || mismatch || undefined}
                disabled={inputsDisabled}
              />
              <button
                type="button"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-pressed={showConfirmPassword}
                aria-controls="ac-confirm-password"
                aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword}
                onClick={onToggleConfirmPassword}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="visually-hidden">{showConfirmPassword ? copy.hidePassword : copy.showPassword}</span>
              </button>
            </span>
          </label>
        ) : null}

        {mismatch || fieldError === 'confirmPassword' ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
            <p>{copy.passwordMismatch}</p>
          </div>
        ) : null}

        {authMode === 'register' ? (
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              checked={termsAccepted}
              onChange={(event) => onTermsChange(event.target.checked)}
              aria-invalid={fieldError === 'terms' || undefined}
            />
            <span>
              {copy.agreeLead}{' '}
              <Link to="/terms" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
                {nav.terms}
              </Link>{' '}
              {copy.agreeAnd}{' '}
              <Link to="/privacy" className="font-semibold text-sky-600 hover:underline dark:text-sky-400">
                {nav.privacy}
              </Link>
              .
            </span>
          </label>
        ) : null}

        {fieldError === 'terms' ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" role="alert">
            <p>{copy.agreeRequired}</p>
          </div>
        ) : null}

        {error && errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200" id="ac-auth-error" role="alert">
            <p>{errorMessage}</p>
            {error === 'duplicate' ? (
              <p className="mt-2">
                <Link to={loginTo} className="font-semibold text-sky-700 underline dark:text-sky-300">
                  {copy.signInInstead}
                </Link>
              </p>
            ) : null}
            {retryable ? (
              <div className="mt-3">
                <Button type="button" variant="secondary" onClick={onRetry}>
                  {copy.retry}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          className="ac-submit w-full"
          disabled={submitDisabled}
          aria-busy={busy === authMode}
          aria-describedby={needsTerms ? 'ac-submit-hint' : undefined}
        >
          {busy === 'register'
            ? copy.submittingRegister
            : busy === 'login'
              ? copy.submittingLogin
              : authMode === 'register'
                ? copy.createAccount
                : copy.signIn}
        </Button>
        {needsTerms ? (
          <p id="ac-submit-hint" className="text-center text-xs text-slate-400">
            {copy.submitNeedsTerms}
          </p>
        ) : null}
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {authMode === 'register' ? (
          <Link to={loginTo} className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400">
            {copy.haveAccount}
          </Link>
        ) : (
          <>
            {copy.noAccount}{' '}
            <Link to={registerTo} className="font-semibold text-sky-600 hover:text-sky-500 dark:text-sky-400">
              {copy.createAccount}
            </Link>
          </>
        )}
      </p>
      {authMode === 'login' ? (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
            <span className="text-xs text-slate-400">{copy.authOr}</span>
            <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
          </div>
          <Link to="/guide" className="btn-secondary w-full">
            <ChromeIcon className="h-4 w-4" />
            {copy.installExtensionCta}
          </Link>
        </>
      ) : null}
    </>
  )
}
