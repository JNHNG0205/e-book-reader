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
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: sentEmail })
    if (resendError) {
      setError(resendError.message)
    } else {
      setResendMessage('Confirmation email resent')
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
      <div className="mx-auto mt-24 max-w-sm p-6">
        <h1 className="mb-4 text-2xl font-bold">Check your email</h1>
        <p className="mb-6 text-sm">
          We sent a confirmation link to <strong>{sentEmail}</strong>. Click it to activate your
          account, then log in.
        </p>
        {error && <p role="alert" className="mb-4 text-sm text-red-600">{error}</p>}
        {resendMessage && <p className="mb-4 text-sm text-green-600">{resendMessage}</p>}
        <button
          type="button"
          onClick={onResend}
          className="mb-2 w-full rounded border py-2 text-sm"
        >
          Resend
        </button>
        <button
          type="button"
          onClick={onBackToLogin}
          className="mt-2 text-sm text-blue-600"
        >
          Back to log in
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold">
        {mode === 'login' ? 'Log in' : 'Sign up'}
      </h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Password</span>
          <input
            type="password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
        >
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        className="mt-4 text-sm text-blue-600"
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </div>
  )
}
