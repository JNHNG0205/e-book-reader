import { useState, type FormEvent } from 'react'
import { supabase } from '@backend/supabase'
import { PasswordInput } from '@frontend/components/PasswordInput'

// Shown when the user arrives via a password-reset link (a recovery session is active).
// They set a new password; on success the USER_UPDATED event clears recovery and the app
// continues to the library.
export function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords don’t match.')
      return
    }
    setBusy(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({ password })
      if (authError) setError(authError.message)
      else setDone(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-xl border border-line bg-paper-raised p-8 shadow-[0_24px_60px_-30px_rgba(27,26,23,0.5)]">
        <h1 className="mb-1 font-serif text-2xl font-semibold tracking-[-0.01em] text-ink">Set a new password</h1>
        <p className="mb-6 text-sm text-ink-soft">Choose a new password for your account.</p>
        {done ? (
          <p className="text-sm text-green-700">Password updated. Taking you to your library…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <PasswordInput label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button
              type="submit" disabled={busy}
              className="w-full rounded-lg bg-accent py-2 font-semibold text-white hover:bg-accent-deep disabled:opacity-50"
            >
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
