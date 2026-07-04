import type { EpubTheme } from './EpubViewer'
import { PageCounter } from './PageCounter'
import { CaretLeftIcon, CaretRightIcon, ThemeIcon } from './icons'

export interface EpubToolbarProps {
  fontSize: number
  theme: EpubTheme
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onGoToPage: (page: number) => void
  onFontSmaller: () => void
  onFontLarger: () => void
  onCycleTheme: () => void
  onBack: () => void
}

export function EpubToolbar({
  fontSize, theme, current, total, onPrev, onNext, onGoToPage, onFontSmaller, onFontLarger,
  onCycleTheme, onBack,
}: EpubToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-paper-raised px-3 py-2 text-sm sm:px-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-deep">
          <CaretLeftIcon className="h-4 w-4" />
          Library
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line px-1.5 py-0.5">
        <button type="button" aria-label="Previous" onClick={onPrev} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft">
          <CaretLeftIcon className="h-4 w-4" />
        </button>
        <PageCounter current={current} total={total} onGoTo={onGoToPage} />
        <button type="button" aria-label="Next" onClick={onNext} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft">
          <CaretRightIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Smaller font" onClick={onFontSmaller} className="grid h-8 w-8 place-items-center rounded-md border border-line font-serif text-xs text-ink-soft hover:bg-line-soft">A</button>
        <span className="w-11 text-center font-mono text-xs tabular-nums text-ink-soft">{fontSize}%</span>
        <button type="button" aria-label="Larger font" onClick={onFontLarger} className="grid h-8 w-8 place-items-center rounded-md border border-line font-serif text-base text-ink-soft hover:bg-line-soft">A</button>
        <button type="button" aria-label="Change theme" onClick={onCycleTheme} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-xs font-medium capitalize text-ink-soft hover:bg-line-soft">
          <ThemeIcon className="h-4 w-4" />{theme}
        </button>
      </div>
    </div>
  )
}
