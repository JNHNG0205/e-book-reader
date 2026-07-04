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
    <div className="flex items-center justify-between gap-4 border-b border-line bg-paper-raised px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-deep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6" /></svg>
          Library
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line px-1.5 py-0.5">
        <button
          type="button" aria-label="Previous page" onClick={onPrev} disabled={page <= 1}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft disabled:opacity-35"
        ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M15 18l-6-6 6-6" /></svg></button>
        <span className="min-w-[4.5rem] text-center font-mono text-[0.8125rem] tabular-nums text-ink">{page} / {numPages || '…'}</span>
        <button
          type="button" aria-label="Next page" onClick={onNext} disabled={page >= numPages}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft disabled:opacity-35"
        ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M9 18l6-6-6-6" /></svg></button>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-soft hover:bg-line-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <span className="w-11 text-center font-mono text-xs tabular-nums text-ink-soft">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-soft hover:bg-line-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
      </div>
    </div>
  )
}
