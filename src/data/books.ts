import { supabase } from '../lib/supabase'
import type { Book, BookFormat } from '../types'

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

export async function listBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Book[]
}

export async function uploadBook(
  file: File,
  meta: { title: string; author?: string; format: BookFormat },
): Promise<Book> {
  const userId = await requireUserId()
  const ext = meta.format === 'pdf' ? 'pdf' : 'epub'
  const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage.from('books').upload(storagePath, file)
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title: meta.title,
      author: meta.author ?? null,
      format: meta.format,
      storage_path: storagePath,
    })
    .select()
    .single()
  if (error) throw error
  return data as Book
}

export async function renameBook(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('books').update({ title }).eq('id', id)
  if (error) throw error
}

export async function deleteBook(id: string): Promise<void> {
  const { data: book, error: readErr } = await supabase
    .from('books').select('storage_path').eq('id', id).single()
  if (readErr) throw readErr
  if (book?.storage_path) {
    await supabase.storage.from('books').remove([book.storage_path])
  }
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}
