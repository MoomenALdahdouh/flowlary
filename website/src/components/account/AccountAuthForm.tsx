import { Link } from 'react-router-dom'
import { Button } from '../Ui.tsx'
import type { AccountClientError } from '../../account/client.ts'

type AccountCopy = ReturnType<typeof import('../../i18n/index.tsx').useMessages>['account']

type AccountAuthFormProps = {
  copy: AccountCopy
  authMode: 'login' | 'register'
  email: string
  password: string
  confirmPassword: string
  showPassword: boolean
  showConfirmPassword: boolean
  fieldError: 'email' | 'password' | 'confirmPassword' | null
  error: AccountClientError | null
  errorMessage: string | null
  busy: 'login' | 'register' | null
  inputsDisabled: boolean
  submitDisabled: boolean
  retryable: boolean
  onAuthModeChange: (mode: 'login' | 'register') => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onToggleConfirmPassword: () => void
  onSubmit: () => void
  onRetry: () => void
}

export function AccountAuthForm({
  copy,
  authMode,
  email,
  password,
  confirmPassword,
  showPassword,
  showConfirmPassword,
  fieldError,
  error,
  errorMessage,
  busy,
  inputsDisabled,
  submitDisabled,
  retryable,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onToggleConfirmPassword,
  onSubmit,
  onRetry,
}: AccountAuthFormProps) {
  return (
    <>
      <div className="ac-mode-tabs" role="tablist" aria-label={copy.kicker}>
        <button
          type="button"
          role="tab"
          className={`ac-mode-tab${authMode === 'login' ? ' is-active' : ''}`}
          aria-selected={authMode === 'login'}
          disabled={inputsDisabled}
          onClick={() => onAuthModeChange('login')}
        >
          {copy.signIn}
        </button>
        <button
          type="button"
          role="tab"
          className={`ac-mode-tab${authMode === 'register' ? ' is-active' : ''}`}
          aria-selected={authMode === 'register'}
          disabled={inputsDisabled}
          onClick={() => onAuthModeChange('register')}
        >
          {copy.createAccount}
        </button>
      </div>

      <article className="ac-auth-card">
        <header className="ac-card-head">
          <h2 className="ac-card-title">
            {authMode === 'register' ? copy.createAccount : copy.signIn}
          </h2>
          <p className="ac-card-subtitle">
            {authMode === 'register' ? copy.createLead : copy.formLead}
          </p>
        </header>

        <form
          className="ac-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <label className="ac-field" htmlFor="ac-email">
            <span>{copy.email}</span>
            <input
              id="ac-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
              aria-invalid={fieldError === 'email' || undefined}
              aria-describedby={error ? 'ac-auth-error' : undefined}
              disabled={inputsDisabled}
            />
          </label>
          <label className="ac-field" htmlFor="ac-password">
            <span>{copy.password}</span>
            <div className="ac-input-wrap">
              <input
                id="ac-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
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
                className="ac-toggle-pw ac-toggle-pw-inline"
                aria-pressed={showPassword}
                aria-controls="ac-password"
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                onClick={onTogglePassword}
              >
                {showPassword ? copy.hidePassword : copy.showPassword}
              </button>
            </div>
          </label>
          {authMode === 'register' ? (
            <>
              <p id="ac-password-hint" className="ac-hint">
                {copy.passwordHint}
              </p>
              <label className="ac-field" htmlFor="ac-confirm-password">
                <span>{copy.confirmPassword}</span>
                <div className="ac-input-wrap">
                  <input
                    id="ac-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => onConfirmPasswordChange(event.target.value)}
                    minLength={8}
                    required
                    aria-invalid={fieldError === 'confirmPassword' || undefined}
                    disabled={inputsDisabled}
                  />
                  <button
                    type="button"
                    className="ac-toggle-pw ac-toggle-pw-inline"
                    aria-pressed={showConfirmPassword}
                    aria-controls="ac-confirm-password"
                    aria-label={showConfirmPassword ? copy.hidePassword : copy.showPassword}
                    onClick={onToggleConfirmPassword}
                  >
                    {showConfirmPassword ? copy.hidePassword : copy.showPassword}
                  </button>
                </div>
              </label>
            </>
          ) : null}

          {fieldError === 'confirmPassword' ? (
            <div className="ac-alert" role="alert">
              <p>{copy.passwordMismatch}</p>
            </div>
          ) : null}

          {error && errorMessage ? (
            <div className="ac-alert" id="ac-auth-error" role="alert">
              <p>{errorMessage}</p>
              {retryable ? (
                <div className="ac-actions">
                  <Button type="button" variant="secondary" onClick={onRetry}>
                    {copy.retry}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <Button
            type="submit"
            className="ac-submit"
            disabled={submitDisabled}
            aria-busy={busy === authMode}
          >
            {busy === 'register'
              ? copy.submittingRegister
              : busy === 'login'
                ? copy.submittingLogin
                : authMode === 'register'
                  ? copy.createAccount
                  : copy.signIn}
          </Button>
          {authMode === 'login' ? (
            <p className="ac-forgot">
              <Link className="ac-link" to="/account/forgot-password">
                {copy.forgotPassword}
              </Link>
            </p>
          ) : null}
        </form>
      </article>

      <p className="ac-switch">
        {authMode === 'register' ? (
          <button
            type="button"
            className="btn btn-link"
            disabled={inputsDisabled}
            onClick={() => onAuthModeChange('login')}
          >
            {copy.haveAccount}
          </button>
        ) : (
          <>
            {copy.noAccount}{' '}
            <button
              type="button"
              className="btn btn-link"
              disabled={inputsDisabled}
              onClick={() => onAuthModeChange('register')}
            >
              {copy.createAccount}
            </button>
          </>
        )}
      </p>
    </>
  )
}
