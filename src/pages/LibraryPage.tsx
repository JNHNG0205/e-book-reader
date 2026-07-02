import { useCallback, useEffect, useState } from 'react'
import type { Book, BookFormat } from '../types'
import { listBooks, uploadBook, renameBook, deleteBook } from '../data/books'
import { BookCard } from '../components/BookCard'
import { UploadButton } from '../components/UploadButton'

export function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setBooks(await listBooks())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function handleUpload(file: File, meta: { title: string; format: BookFormat }) {
    try {
      await uploadBook(file, meta)
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
        <UploadButton onUpload={handleUpload} />
      </div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : books.length === 0 ? (
        <p className="text-gray-500">No books yet — add your first PDF or EPUB.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard key={b.id} book={b} onRename={handleRename} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
