import { supabase } from '@backend/supabase'

export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}
