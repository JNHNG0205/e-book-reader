import { supabase } from '@backend/supabase'
import { requireUserId } from './currentUser'

export async function getProgress(bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('location')
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data?.location ?? null
}

export async function saveProgress(bookId: string, location: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('reading_progress')
    .upsert({ user_id: userId, book_id: bookId, location }, { onConflict: 'user_id,book_id' })
  if (error) throw error
}
