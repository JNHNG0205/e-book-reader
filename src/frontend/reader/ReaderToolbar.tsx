export interface ReaderToolbarProps {
  page: number
  numPages: number
  scale: number
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onBack: () => void
}

export function ReaderToolbar({
  page, numPages, scale, onPrev, onNext, onZoomIn, onZoomOut, onBack,
}: ReaderToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-blue-600">← Library</button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button" aria-label="Previous page" onClick={onPrev} disabled={page <= 1}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >‹</button>
        <span>{page} / {numPages || '…'}</span>
        <button
          type="button" aria-label="Next page" onClick={onNext} disabled={page >= numPages}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >›</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} className="rounded border px-2 py-1">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} className="rounded border px-2 py-1">+</button>
      </div>
    </div>
  )
}
