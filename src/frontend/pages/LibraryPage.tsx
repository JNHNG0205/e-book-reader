import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Book, BookFormat } from '@shared/types'
import {
  listBooks, uploadBook, renameBook, deleteBook, getCoverUrl, getBookFileUrl, saveCover,
  updateBookMetadata,
} from '@backend/data/books'
import { extractCoverBlob } from '@frontend/library/coverExtract'
import { extractBookMetadata } from '@frontend/library/bookMetadata'
import { cachedBookIds } from '@frontend/offline/bookCache'
import { BookCard } from '@frontend/components/BookCard'
import { UploadButton } from '@frontend/components/UploadButton'

const LIBRARY_CACHE_KEY = 'library.books'

function loadCachedBooks(): Book[] | null {
  const raw = localStorage.getItem(LIBRARY_CACHE_KEY)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Book[]) : null
  } catch {
    return null
  }
}

export function LibraryPage() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [covers, setCovers] = useState<Record<string, string>>({})
  const [offlineIds, setOfflineIds] = useState<Set<string>>(new Set())
  const processedCoverIds = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const fetched = await listBooks()
      setBooks(fetched)
      setOffline(false)
      try {
        localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(fetched))
      } catch {
        // best-effort cache; ignore storage failures (e.g. quota, privacy mode)
      }
    } catch (e) {
      const cached = loadCachedBooks()
      if (cached) {
        setBooks(cached)
        setOffline(true)
      } else {
        setError((e as Error).message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    void cachedBookIds()
      .then((ids) => setOfflineIds(new Set(ids)))
      .catch(() => {
        // offline-cache lookup is best-effort; leave badges unset on failure
      })
  }, [books])

  useEffect(() => {
    const pending = books.filter((b) => !processedCoverIds.current.has(b.id))
    if (pending.length === 0) return
    for (const b of pending) processedCoverIds.current.add(b.id)

    void Promise.all(pending.map(async (b) => {
      try {
        let path = b.cover_path
        if (!path) {
          const url = await getBookFileUrl(b.storage_path)
          const buf = await (await fetch(url)).arrayBuffer()

          try {
            const info = await extractBookMetadata(buf, b.format)
            if ((info.title && info.title !== b.title) || info.author) {
              const fields = {
                ...(info.title ? { title: info.title } : {}),
                ...(info.author ? { author: info.author } : {}),
              }
              await updateBookMetadata(b.id, fields)
              setBooks((prev) => prev.map((x) => (
                x.id === b.id ? { ...x, title: info.title ?? x.title, author: info.author ?? x.author } : x
              )))
            }
          } catch {
            // metadata backfill failure must not block cover extraction
          }

          const blob = await extractCoverBlob(buf, b.format)
          if (!blob) return
          path = await saveCover(b.id, blob)
        }
        const signed = await getCoverUrl(path)
        setCovers((prev) => ({ ...prev, [b.id]: signed }))
      } catch {
        // leave placeholder on failure
      }
    }))
  }, [books])

  async function handleUpload(file: File, meta: { title: string; format: BookFormat }) {
    try {
      const buf = await file.arrayBuffer()
      const info = await extractBookMetadata(buf, meta.format)
      await uploadBook(file, {
        title: info.title ?? meta.title,
        author: info.author ?? undefined,
        format: meta.format,
      })
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function handleRename(id: string, title: string) {
    try {
      await renameBook(id, title)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function handleDelete(id: string) {
    try {
      await deleteBook(id)
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">My library</h2>
        <UploadButton onUpload={handleUpload} onReject={setError} />
      </div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {offline && (
        <p className="mb-4 text-sm text-gray-500">Offline — showing your saved library</p>
      )}
      {loading ? (
        <p>Loading…</p>
      ) : books.length === 0 ? (
        <p className="text-gray-500">No books yet — add your first PDF or EPUB.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              coverUrl={covers[b.id] ?? null}
              offlineAvailable={offlineIds.has(b.id)}
              onOpen={(id) => navigate('/read/' + id)}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
