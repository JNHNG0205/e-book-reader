import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@backend/supabase'

export interface SessionState {
  session: Session | null
  loading: boolean
  // True after the user returns via a password-reset link, until they set a new password.
  recovery: boolean
}

export const SessionContext = createContext<SessionState>({ session: null, loading: true, recovery: false })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => { setSession(data.session); setLoading(false) })
      .catch(() => setLoading(false))
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      else if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setRecovery(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext.Provider value={{ session, loading, recovery }}>{children}</SessionContext.Provider>
}
