import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Book, BookFormat } from '@shared/types'
import {
  listBooks, uploadBook, renameBook, deleteBook, getCoverUrl, getBookFileUrl, saveCover,
  updateBookMetadata,
} from '@backend/data/books'
import { getAllProgress } from '@frontend/offline/offlineData'
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
  const [percents, setPercents] = useState<Record<string, number | null>>({})
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

  // Completion percent per book for the library — offline-capable (reads the local
  // progress cache, overlaid with the server list when online).
  useEffect(() => {
    void getAllProgress()
      .then((rows) => {
        const map: Record<string, number | null> = {}
        for (const r of rows) map[r.book_id] = r.percent
        setPercents(map)
      })
      .catch(() => { /* best-effort — leave percents unset */ })
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="u-label mb-1.5">Your shelf</div>
          <h2 className="font-serif text-2xl font-semibold tracking-[-0.01em] text-ink">Library</h2>
        </div>
        <UploadButton onUpload={handleUpload} onReject={setError} />
      </div>

      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
      {offline && (
        <p className="mb-5 inline-flex items-center gap-2 rounded-md bg-line-soft px-3 py-1.5 text-sm text-ink-soft">
          Offline — showing your saved library
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft">Loading…</p>
      ) : books.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line py-20 text-center">
          <p className="font-serif text-lg text-ink">Your shelf is empty.</p>
          <p className="mt-1 text-sm text-ink-soft">Add your first PDF or EPUB to start reading.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard
              key={b.id}
              book={b}
              coverUrl={covers[b.id] ?? null}
              offlineAvailable={offlineIds.has(b.id)}
              percent={percents[b.id] ?? null}
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
