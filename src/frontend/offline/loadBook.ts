import { getBookFileUrl } from '@backend/data/books'
import { getCachedBook, putCachedBook } from './bookCache'
import type { BookFormat } from '@shared/types'

function mimeFor(format: BookFormat): string {
  return format === 'pdf' ? 'application/pdf' : 'application/epub+zip'
}

// Resolves a book to a local blob URL, caching its bytes on first (online) open so later
// opens — including offline — work from IndexedDB. Callers must revokeObjectURL when done.
export async function loadBookObjectUrl(
  bookId: string,
  storagePath: string,
  format: BookFormat,
): Promise<string> {
  // A read failure (IndexedDB disabled / private browsing / quota) is treated as a cache
  // miss so we still fall through to the network — never a false "unavailable offline".
  const cached = await getCachedBook(bookId).catch(() => null)
  if (cached) return URL.createObjectURL(new Blob([cached], { type: mimeFor(format) }))

  const url = await getBookFileUrl(storagePath)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download book (${res.status})`)
  const bytes = await res.arrayBuffer()
  await putCachedBook(bookId, bytes).catch(() => { /* cache is best-effort */ })
  return URL.createObjectURL(new Blob([bytes], { type: mimeFor(format) }))
}
