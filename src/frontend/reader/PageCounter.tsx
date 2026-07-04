import { useEffect, useState, type FormEvent } from 'react'

// Editable page indicator: shows "current / total", and lets the reader type a page number
// and press Enter (or blur) to jump there. Shows a placeholder while the total is unknown
// (EPUB still generating its location index).
export function PageCounter({
  current, total, onGoTo,
}: {
  current: number
  total: number
  onGoTo: (page: number) => void
}) {
  const [draft, setDraft] = useState(String(current))
  // Keep the field in sync when the page changes elsewhere (nav buttons, swipe, resume).
  useEffect(() => { setDraft(String(current)) }, [current])

  if (!total) {
    return (
      <span className="min-w-[4.5rem] text-center text-ink-faint" title="Calculating pages…">…</span>
    )
  }

  function commit() {
    const n = parseInt(draft, 10)
    if (Number.isFinite(n) && n >= 1 && n <= total) onGoTo(n)
    else setDraft(String(current))
  }

  return (
    <form
      onSubmit={(e: FormEvent) => { e.preventDefault(); commit() }}
      className="flex items-center gap-1 font-mono text-[0.8125rem] tabular-nums text-ink"
    >
      <input
        aria-label="Go to page"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onFocus={(e) => e.target.select()}
        onBlur={commit}
        className="w-10 rounded border border-line bg-paper py-0.5 text-center text-ink focus:border-accent focus:outline-none"
      />
      <span className="text-ink-faint">/ {total}</span>
    </form>
  )
}
