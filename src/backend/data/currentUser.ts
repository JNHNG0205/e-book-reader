import { supabase } from '@backend/supabase'

export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

/**
 * Offline-safe local user id: reads the persisted session (no network call),
 * unlike requireUserId()/getUser() which hits the network and fails offline.
 */
export async function getUserIdLocal(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}
