import { PageCounter } from './PageCounter'
import { CaretLeftIcon, CaretRightIcon, PlusIcon, MinusIcon } from './icons'

export interface ReaderToolbarProps {
  page: number
  numPages: number
  scale: number
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onGoToPage: (page: number) => void
  onBack: () => void
}

export function ReaderToolbar({
  page, numPages, scale, onPrev, onNext, onZoomIn, onZoomOut, onGoToPage, onBack,
}: ReaderToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-paper-raised px-3 py-2 text-sm sm:px-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-deep">
          <CaretLeftIcon className="h-4 w-4" />
          Library
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line px-1.5 py-0.5">
        <button
          type="button" aria-label="Previous page" onClick={onPrev} disabled={page <= 1}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft disabled:opacity-35"
        ><CaretLeftIcon className="h-4 w-4" /></button>
        <PageCounter current={page} total={numPages} onGoTo={onGoToPage} />
        <button
          type="button" aria-label="Next page" onClick={onNext} disabled={page >= numPages}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft disabled:opacity-35"
        ><CaretRightIcon className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-soft hover:bg-line-soft">
          <MinusIcon className="h-4 w-4" />
        </button>
        <span className="w-11 text-center font-mono text-xs tabular-nums text-ink-soft">{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} className="grid h-8 w-8 place-items-center rounded-md border border-line text-ink-soft hover:bg-line-soft">
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
