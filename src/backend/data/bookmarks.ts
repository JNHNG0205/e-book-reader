import { supabase } from '@backend/supabase'
import { requireUserId } from './currentUser'
import type { Bookmark } from '@shared/types'

export async function listBookmarks(bookId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Bookmark[]
}

export async function saveBookmark(
  bookId: string,
  fields: { location: string; label?: string },
): Promise<Bookmark> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, book_id: bookId, location: fields.location, label: fields.label ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Bookmark
}

export async function deleteBookmark(id: string): Promise<void> {
  const { error } = await supabase.from('bookmarks').delete().eq('id', id)
  if (error) throw error
}
