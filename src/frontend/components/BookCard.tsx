import { useState } from 'react'
import type { Book } from '@shared/types'
import { RenameDialog } from '@frontend/components/RenameDialog'
import { ConfirmDialog } from '@frontend/components/ConfirmDialog'
import { OfflineIcon } from '@frontend/reader/icons'

export function BookCard({
  book, coverUrl, offlineAvailable, onOpen, onRename, onDelete,
}: {
  book: Book
  coverUrl?: string | null
  offlineAvailable?: boolean
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
        className="relative mb-2 flex aspect-[3/4] items-center justify-center overflow-hidden rounded bg-gray-100 text-gray-400 hover:bg-gray-200"
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="h-full w-full rounded object-cover" />
        ) : (
          book.format.toUpperCase()
        )}
        {offlineAvailable && (
          <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-gray-900/80 px-1.5 py-0.5 text-xs font-medium text-white">
            <OfflineIcon className="h-3 w-3" />
            Offline
          </span>
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
