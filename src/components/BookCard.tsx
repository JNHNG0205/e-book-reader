import type { Book } from '../types'

export function BookCard({
  book, onRename, onDelete,
}: {
  book: Book
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col rounded border p-3">
      <div className="mb-2 flex aspect-[3/4] items-center justify-center rounded bg-gray-100 text-gray-400">
        {book.format.toUpperCase()}
      </div>
      <div className="font-medium">{book.title}</div>
      {book.author && <div className="text-sm text-gray-500">{book.author}</div>}
      <div className="mt-2 flex gap-3 text-sm">
        <button
          className="text-blue-600"
          onClick={() => {
            const title = window.prompt('New title', book.title)
            if (title && title !== book.title) onRename(book.id, title)
          }}
        >
          Rename
        </button>
        <button
          className="text-red-600"
          onClick={() => {
            if (window.confirm(`Delete "${book.title}"?`)) onDelete(book.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
