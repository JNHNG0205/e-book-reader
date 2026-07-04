import { useState, type FormEvent } from 'react'
import { supabase } from '@backend/supabase'
import { PasswordInput } from '@frontend/components/PasswordInput'

type Mode = 'login' | 'signup' | 'reset'

const card = 'w-full max-w-sm rounded-xl border border-line bg-paper-raised p-8 shadow-[0_24px_60px_-30px_rgba(27,26,23,0.5)]'
const field = 'mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink focus:border-accent focus:outline-none'
const primary = 'w-full rounded-lg bg-accent py-2 font-semibold text-white hover:bg-accent-deep disabled:opacity-50'
const link = 'text-sm font-medium text-accent hover:text-accent-deep'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false) // signup confirmation email sent
  const [resetSent, setResetSent] = useState(false) // password-reset email sent
  const [sentEmail, setSentEmail] = useState('')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'reset') {
      setBusy(true)
      try {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (authError) setError(authError.message)
        else { setSentEmail(email); setResetSent(true) }
      } finally { setBusy(false) }
      return
    }

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords don’t match.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) setError(authError.message)
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        })
        if (authError) setError(authError.message)
        else if (!data.session) { setSentEmail(email); setSent(true) }
      }
    } finally { setBusy(false) }
  }

  async function onResend() {
    setError(null)
    setResendMessage(null)
    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: sentEmail })
      if (resendError) setError(resendError.message)
      else setResendMessage('Confirmation email resent')
    } finally { setResending(false) }
  }

  function backToLogin() {
    setSent(false)
    setResetSent(false)
    setMode('login')
    setError(null)
    setResendMessage(null)
    setPassword('')
    setConfirm('')
  }

  // Signup confirmation email sent.
  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className={card}>
          <h1 className="mb-4 font-serif text-2xl font-semibold tracking-[-0.01em] text-ink">Check your email</h1>
          <p className="mb-6 text-sm leading-relaxed text-ink-soft">
            We sent a confirmation link to <strong className="text-ink">{sentEmail}</strong>. Click it to
            activate your account, then log in.
          </p>
          {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
          {resendMessage && <p className="mb-4 text-sm text-green-700">{resendMessage}</p>}
          <button
            type="button" onClick={onResend} disabled={resending}
            className="mb-2 w-full rounded-lg border border-line py-2 text-sm font-medium text-ink hover:bg-line-soft disabled:opacity-50"
          >
            Resend
          </button>
          <button type="button" onClick={backToLogin} className={`mt-2 ${link}`}>Back to log in</button>
        </div>
      </div>
    )
  }

  // Password-reset email sent.
  if (resetSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className={card}>
          <h1 className="mb-4 font-serif text-2xl font-semibold tracking-[-0.01em] text-ink">Check your email</h1>
          <p className="mb-6 text-sm leading-relaxed text-ink-soft">
            If an account exists for <strong className="text-ink">{sentEmail}</strong>, we sent a link to
            reset your password. Open it to choose a new one.
          </p>
          <button type="button" onClick={backToLogin} className={link}>Back to log in</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className={card}>
        <div className="mb-1 font-serif text-lg font-semibold tracking-[-0.01em] text-ink">
          E-Book <span className="text-accent">Reader</span>
        </div>
        <h1 className="mb-6 text-sm text-ink-soft">
          {mode === 'login' ? 'Log in to your library.'
            : mode === 'signup' ? 'Create your library.'
            : 'Reset your password.'}
        </h1>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="u-label">Email</span>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
          </label>

          {mode !== 'reset' && (
            <PasswordInput
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          )}

          {mode === 'signup' && (
            <PasswordInput
              label="Confirm password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
            />
          )}

          {mode === 'login' && (
            <button type="button" onClick={() => { setMode('reset'); setError(null) }} className={`block ${link}`}>
              Forgot password?
            </button>
          )}

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={busy} className={primary}>
            {mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset link'}
          </button>
        </form>

        {mode === 'reset' ? (
          <button type="button" onClick={backToLogin} className={`mt-4 ${link}`}>Back to log in</button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            className={`mt-4 ${link}`}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
          </button>
        )}
      </div>
    </div>
  )
}
