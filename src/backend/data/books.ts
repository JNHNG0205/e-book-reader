import { supabase } from '@backend/supabase'
import type { Book, BookFormat } from '@shared/types'
import { requireUserId } from './currentUser'

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
  const ext = meta.format
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
  if (error) {
    await supabase.storage.from('books').remove([storagePath])
    throw error
  }
  return data as Book
}

export async function renameBook(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('books').update({ title }).eq('id', id)
  if (error) throw error
}

export async function getBook(id: string): Promise<Book> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).single()
  if (error) throw error
  return data as Book
}

export async function getBookFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('books').createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function getCoverUrl(coverPath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('books').createSignedUrl(coverPath, 3600)
  if (error) throw error
  return data.signedUrl
}

export async function saveCover(bookId: string, blob: Blob): Promise<string> {
  const userId = await requireUserId()
  const coverPath = `${userId}/${crypto.randomUUID()}-cover.jpg`

  const { error: upErr } = await supabase.storage
    .from('books')
    .upload(coverPath, blob, { contentType: blob.type || 'image/jpeg' })
  if (upErr) throw upErr

  const { error } = await supabase.from('books').update({ cover_path: coverPath }).eq('id', bookId)
  if (error) throw error

  return coverPath
}

export async function deleteBook(id: string): Promise<void> {
  const { data: book, error: readErr } = await supabase
    .from('books').select('storage_path').eq('id', id).single()
  if (readErr) throw readErr
  if (book?.storage_path) {
    const { error: storageErr } = await supabase.storage.from('books').remove([book.storage_path])
    if (storageErr) throw storageErr
  }
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}
