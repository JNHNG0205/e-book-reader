import type { ReactNode } from 'react'
import { useSession } from '@frontend/auth/useSession'
import { LoginPage } from '@frontend/auth/LoginPage'
import { UpdatePasswordPage } from '@frontend/auth/UpdatePasswordPage'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, recovery } = useSession()
  if (loading) return <div className="mt-24 text-center">Loading…</div>
  // A reset link signs the user in with a recovery session — make them set a new password
  // before reaching the app.
  if (recovery) return <UpdatePasswordPage />
  if (!session) return <LoginPage />
  return <>{children}</>
}
