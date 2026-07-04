import { useState } from 'react'
import type { Highlight } from '@shared/types'
import { HIGHLIGHT_COLORS, colorValue } from './highlightColors'
import { TrashIcon } from './icons'

export function HighlightsPanel({
  highlights, onJump, onDelete,
}: {
  highlights: Highlight[]
  onJump: (h: Highlight) => void
  onDelete: (id: string) => void
}) {
  const [filter, setFilter] = useState<string | null>(null)
  const shown = filter ? highlights.filter((h) => h.color === filter) : highlights

  return (
    <div className="text-sm">
      <div className="flex flex-wrap gap-1 border-b border-line-soft p-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded px-2 py-0.5 text-xs ${filter === null ? 'bg-line font-medium text-ink' : 'text-ink-soft'}`}
        >
          All
        </button>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.label}
            onClick={() => setFilter(c.key)}
            className={`rounded px-2 py-0.5 text-xs ${filter === c.key ? 'ring-2 ring-black' : ''}`}
            style={{ backgroundColor: c.value }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="p-3 text-ink-faint">No highlights yet.</p>
      ) : (
        <ul className="p-2">
          {shown.map((hl) => {
            const text = String((hl.anchor as { text?: string })?.text ?? '')
            return (
              <li key={hl.id} className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-line-soft">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colorValue(hl.color) }}
                />
                <button type="button" onClick={() => onJump(hl)} className="flex-1 text-left text-ink">
                  <span className="line-clamp-2">{text || '(highlight)'}</span>
                  {hl.note && <span className="mt-0.5 block text-xs text-ink-soft">{hl.note}</span>}
                </button>
                <button
                  type="button"
                  aria-label="Delete highlight"
                  onClick={() => onDelete(hl.id)}
                  className="mt-0.5 text-ink-faint opacity-0 hover:text-red-700 group-hover:opacity-100"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
