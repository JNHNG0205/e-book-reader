import { useState } from 'react'

// A seekable reading-position bar. While the reader drags the thumb we only show a preview
// (the percentage updates live) and commit the jump on release — so we don't fire a display()
// on every intermediate value, which would make dragging lurch.
export function ReadingProgressBar({
  current, total, onSeek,
}: {
  current: number
  total: number
  onSeek: (page: number) => void
}) {
  const [preview, setPreview] = useState<number | null>(null)
  if (!total) return null

  const value = preview ?? current
  const commit = () => {
    if (preview != null) { onSeek(preview); setPreview(null) }
  }
  const pct = Math.round((value / total) * 100)

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        type="range"
        aria-label="Reading progress"
        min={1}
        max={total}
        value={value}
        onChange={(e) => setPreview(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-accent"
      />
      <span className="w-9 text-right font-mono text-[0.6875rem] tabular-nums text-ink-soft">{pct}%</span>
    </div>
  )
}
