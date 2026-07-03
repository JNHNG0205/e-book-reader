import { useState } from 'react'
import type { Book } from '@shared/types'
import { RenameDialog } from '@frontend/components/RenameDialog'
import { ConfirmDialog } from '@frontend/components/ConfirmDialog'

export function BookCard({
  book, coverUrl, onOpen, onRename, onDelete,
}: {
  book: Book
  coverUrl?: string | null
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [dialog, setDialog] = useState<'none' | 'rename' | 'delete'>('none')

  return (
    <div className="flex flex-col rounded border p-3">
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        className="mb-2 flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-gray-100 text-gray-400 hover:bg-gray-200"
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full rounded object-cover" />
        ) : (
          book.format.toUpperCase()
        )}
      </button>
      <button type="button" onClick={() => onOpen(book.id)} className="text-left font-medium hover:underline">
        {book.title}
      </button>
      {book.author && <div className="text-sm text-gray-500">{book.author}</div>}
      <div className="mt-2 flex gap-3 text-sm">
        <button
          className="text-blue-600"
          onClick={() => setDialog('rename')}
        >
          Rename
        </button>
        <button
          className="text-red-600"
          onClick={() => setDialog('delete')}
        >
          Delete
        </button>
      </div>
      {dialog === 'rename' && (
        <RenameDialog
          initialValue={book.title}
          onSave={(v) => {
            if (v !== book.title) onRename(book.id, v)
            setDialog('none')
          }}
          onCancel={() => setDialog('none')}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          title="Delete book"
          message={`Delete "${book.title}"? This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            onDelete(book.id)
            setDialog('none')
          }}
          onCancel={() => setDialog('none')}
        />
      )}
    </div>
  )
}
