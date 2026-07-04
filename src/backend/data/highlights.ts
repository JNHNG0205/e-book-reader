import { supabase } from '@backend/supabase'
import { requireUserId } from './currentUser'
import type { Highlight } from '@shared/types'

export async function listHighlights(bookId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Highlight[]
}

export async function saveHighlight(
  bookId: string,
  fields: { color: string; note?: string | null; anchor: Record<string, unknown> },
): Promise<Highlight> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: userId,
      book_id: bookId,
      color: fields.color,
      note: fields.note ?? null,
      anchor: fields.anchor,
    })
    .select()
    .single()
  if (error) throw error
  return data as Highlight
}

export async function updateHighlight(
  id: string,
  fields: { color?: string; note?: string | null },
): Promise<void> {
  const { error } = await supabase.from('highlights').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase.from('highlights').delete().eq('id', id)
  if (error) throw error
}

/**
 * Upserts a full highlight row (including client-generated id/user_id/book_id/timestamps),
 * so replaying an offline-created row from the outbox is idempotent.
 */
export async function upsertHighlight(row: Highlight): Promise<void> {
  const { error } = await supabase.from('highlights').upsert(row)
  if (error) throw error
}
