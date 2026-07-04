import { useState } from 'react'
import type { Book } from '@shared/types'
import { RenameDialog } from '@frontend/components/RenameDialog'
import { ConfirmDialog } from '@frontend/components/ConfirmDialog'
import { OfflineIcon, CheckIcon } from '@frontend/reader/icons'

// Bookbinding-cloth colours for the fallback cover (a file with no extractable art).
// Chosen deterministically per book so a title always wears the same cloth.
const CLOTH = ['#3a4048', '#582a2a', '#2c3d33', '#3c2a44', '#22403f', '#28324a', '#6f571d', '#2c2b29']
function clothFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h + id.charCodeAt(i)) % CLOTH.length
  return CLOTH[h]
}
function monogram(title: string): string {
  return (title.trim()[0] ?? '?').toUpperCase()
}

// A bookmark-ribbon shape whose height encodes how far through the book the reader is.
function ribbonStyle(heightPct: number, finished: boolean): React.CSSProperties {
  return {
    height: `${heightPct}%`,
    backgroundColor: finished ? '#8a6d2f' : '#2c2d8c',
    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 5px), 0 100%)',
  }
}

export function BookCard({
  book, coverUrl, offlineAvailable, percent, onOpen, onRename, onDelete,
}: {
  book: Book
  coverUrl?: string | null
  offlineAvailable?: boolean
  percent?: number | null
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  const [dialog, setDialog] = useState<'none' | 'rename' | 'delete'>('none')
  const pct = percent == null ? null : Math.max(0, Math.min(100, Math.round(percent)))
  const finished = pct != null && pct >= 100

  return (
    <div className="group flex flex-col">
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        aria-label={`Open ${book.title}`}
        className="relative block aspect-[3/4.35] overflow-hidden rounded-[3px_6px_6px_3px] shadow-[inset_5px_0_0_rgba(0,0,0,0.16),0_10px_22px_-14px_rgba(27,26,23,0.6)] transition-transform duration-200 group-hover:-translate-y-1"
      >
        {coverUrl ? (
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          // Typeset cloth fallback — format + a serif monogram, no grey placeholder.
          <span
            className="absolute inset-0 flex flex-col p-4 text-[#efe9dd]"
            style={{ backgroundColor: clothFor(book.id) }}
          >
            <span className="u-label border-b border-white/25 pb-2 text-[0.5625rem] text-white/70">
              {book.format.toUpperCase()}
            </span>
            <span className="flex flex-1 items-center justify-center font-serif text-5xl font-semibold text-white/85">
              {monogram(book.title)}
            </span>
          </span>
        )}

        {pct != null && pct > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0 right-4 w-[13px] shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
            style={ribbonStyle(pct, finished)}
          />
        )}
        {finished && (
          <span className="absolute bottom-2.5 right-2.5 grid h-6 w-6 place-items-center rounded-full bg-seal text-[#f7efdc] shadow-[0_2px_6px_rgba(0,0,0,0.3)]">
            <CheckIcon className="h-3.5 w-3.5" weight="bold" />
          </span>
        )}
        {offlineAvailable && (
          <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider text-[#f3efe6] backdrop-blur-[1px]">
            <OfflineIcon className="h-2.5 w-2.5" />
            Offline
          </span>
        )}
      </button>

      <div className="pt-3">
        <button
          type="button"
          onClick={() => onOpen(book.id)}
          className="text-left font-serif text-[0.9375rem] font-semibold leading-tight tracking-[-0.005em] text-ink hover:text-accent"
        >
          {book.title}
        </button>
        {book.author && <div className="mt-0.5 text-xs text-ink-soft">{book.author}</div>}

        {finished ? (
          <div className="mt-2.5 flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-wider text-seal">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Finished
          </div>
        ) : pct != null ? (
          <div className="mt-2.5 flex items-center gap-2" aria-label={`${pct}% complete`}>
            <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </span>
            <span className="font-mono text-[0.6875rem] tabular-nums text-ink-soft">{pct}%</span>
          </div>
        ) : null}

        <div className="mt-2.5 flex gap-4 text-[0.8125rem]">
          <button className="text-ink-soft hover:text-accent" onClick={() => setDialog('rename')}>
            Rename
          </button>
          <button className="text-ink-soft hover:text-red-700" onClick={() => setDialog('delete')}>
            Delete
          </button>
        </div>
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
