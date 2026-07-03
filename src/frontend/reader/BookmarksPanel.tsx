import type { Bookmark } from '@shared/types'

export function BookmarksPanel({
  bookmarks, onJump, onDelete,
}: {
  bookmarks: Bookmark[]
  onJump: (location: string) => void
  onDelete: (id: string) => void
}) {
  if (bookmarks.length === 0) {
    return <p className="p-3 text-sm text-gray-400">No bookmarks yet.</p>
  }
  return (
    <ul className="p-2 text-sm">
      {bookmarks.map((b) => (
        <li key={b.id} className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100">
          <button type="button" onClick={() => onJump(b.location)} className="flex-1 truncate text-left">
            {b.label ?? 'Bookmark'}
          </button>
          <button
            type="button"
            aria-label="Delete bookmark"
            onClick={() => onDelete(b.id)}
            className="text-red-600 opacity-0 group-hover:opacity-100"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
