import { useState, type FormEvent } from 'react'
import { supabase } from '@backend/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
        if (authError) {
          setError(authError.message)
        } else if (!data.session) {
          setSentEmail(email)
          setSent(true)
        }
      }
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    setError(null)
    setResendMessage(null)
    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: sentEmail })
      if (resendError) {
        setError(resendError.message)
      } else {
        setResendMessage('Confirmation email resent')
      }
    } finally {
      setResending(false)
    }
  }

  function onBackToLogin() {
    setSent(false)
    setMode('login')
    setError(null)
    setResendMessage(null)
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-8 shadow-[0_24px_60px_-30px_rgba(27,26,23,0.5)]">
          <h1 className="mb-4 font-serif text-2xl font-semibold tracking-[-0.01em] text-ink">Check your email</h1>
          <p className="mb-6 text-sm leading-relaxed text-ink-soft">
            We sent a confirmation link to <strong className="text-ink">{sentEmail}</strong>. Click it to
            activate your account, then log in.
          </p>
          {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
          {resendMessage && <p className="mb-4 text-sm text-green-700">{resendMessage}</p>}
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            className="mb-2 w-full rounded-lg border border-line py-2 text-sm font-medium text-ink hover:bg-line-soft disabled:opacity-50"
          >
            Resend
          </button>
          <button type="button" onClick={onBackToLogin} className="mt-2 text-sm font-medium text-accent hover:text-accent-deep">
            Back to log in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-8 shadow-[0_24px_60px_-30px_rgba(27,26,23,0.5)]">
        <div className="mb-1 font-serif text-lg font-semibold tracking-[-0.01em] text-ink">
          E-Book <span className="text-accent">Reader</span>
        </div>
        <h1 className="mb-6 text-sm text-ink-soft">
          {mode === 'login' ? 'Log in to your library.' : 'Create your library.'}
        </h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="u-label">Email</span>
            <input
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="u-label">Password</span>
            <input
              type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink focus:border-accent focus:outline-none"
            />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full rounded-lg bg-accent py-2 font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
          >
            {mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          className="mt-4 text-sm font-medium text-accent hover:text-accent-deep"
        >
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
