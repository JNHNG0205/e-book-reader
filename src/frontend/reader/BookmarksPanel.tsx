import type { Bookmark } from '@shared/types'

export function BookmarksPanel({
  bookmarks, onJump, onDelete,
}: {
  bookmarks: Bookmark[]
  onJump: (location: string) => void
  onDelete: (id: string) => void
}) {
  if (bookmarks.length === 0) {
    return <p className="p-3 text-sm text-ink-faint">No bookmarks yet.</p>
  }
  return (
    <ul className="p-2 text-sm">
      {bookmarks.map((b) => (
        <li key={b.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-line-soft">
          <button type="button" onClick={() => onJump(b.location)} className="flex-1 truncate text-left text-ink">
            {b.label ?? 'Bookmark'}
          </button>
          <button
            type="button"
            aria-label="Delete bookmark"
            onClick={() => onDelete(b.id)}
            className="text-ink-faint opacity-0 hover:text-red-700 group-hover:opacity-100"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
