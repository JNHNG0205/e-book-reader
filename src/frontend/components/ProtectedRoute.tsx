import type { ReactNode } from 'react'
import { useSession } from '@frontend/auth/useSession'
import { LoginPage } from '@frontend/auth/LoginPage'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  if (loading) return <div className="mt-24 text-center">Loading…</div>
  if (!session) return <LoginPage />
  return <>{children}</>
}
