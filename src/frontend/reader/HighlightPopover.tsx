import { useEffect, useRef, useState } from 'react'
import { HIGHLIGHT_COLORS } from './highlightColors'

export interface HighlightPopoverProps {
  x: number
  y: number
  mode: 'create' | 'edit'
  color?: string
  note?: string | null
  onPickColor: (key: string) => void
  onSaveNote?: (note: string) => void
  onDelete?: () => void
  onClose: () => void
}

export function HighlightPopover({
  x, y, mode, color, note, onPickColor, onSaveNote, onDelete, onClose,
}: HighlightPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(note ?? '')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      clearTimeout(t)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      // Anchored above the selection (translate up) so it doesn't cover the text.
      className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg border bg-white p-2 shadow-lg"
      style={{ left: x, top: y - 8 }}
    >
      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.label}
            onClick={() => onPickColor(c.key)}
            className={`h-6 w-6 rounded-full border ${color === c.key ? 'ring-2 ring-black' : ''}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      {mode === 'edit' && (
        <div className="mt-2 w-56">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            className="h-16 w-full rounded border p-1 text-sm"
          />
          <div className="mt-1 flex justify-between">
            <button type="button" onClick={() => onDelete?.()} className="text-sm text-red-600">Delete</button>
            <button
              type="button"
              onClick={() => onSaveNote?.(draft)}
              className="rounded bg-black px-2 py-1 text-sm text-white"
            >
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
