import { useState } from 'react'
import type { EpubTheme } from './EpubViewer'
import { PageCounter } from './PageCounter'
import { ReadingProgressBar } from './ReadingProgressBar'
import { TypePanel } from './TypePanel'
import { CaretLeftIcon, CaretRightIcon } from './icons'

export interface EpubToolbarProps {
  fontSize: number
  lineHeight: number
  margin: number
  theme: EpubTheme
  current: number
  total: number
  chapter?: string | null
  onPrev: () => void
  onNext: () => void
  onGoToPage: (page: number) => void
  onSeek: (page: number) => void
  onFontSize: (n: number) => void
  onLineHeight: (n: number) => void
  onMargin: (n: number) => void
  onSetTheme: (t: EpubTheme) => void
  onBack: () => void
}

export function EpubToolbar({
  fontSize, lineHeight, margin, theme, current, total, chapter,
  onPrev, onNext, onGoToPage, onSeek, onFontSize, onLineHeight, onMargin, onSetTheme, onBack,
}: EpubToolbarProps) {
  const [typeOpen, setTypeOpen] = useState(false)

  return (
    <div className="border-b border-line bg-paper-raised">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 text-sm sm:px-4">
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
        <div className="relative flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Text settings"
            aria-expanded={typeOpen}
            onClick={() => setTypeOpen((v) => !v)}
            className={`inline-flex h-8 items-center gap-1 rounded-md border px-2.5 font-serif text-ink-soft hover:bg-line-soft ${
              typeOpen ? 'border-accent bg-accent-tint' : 'border-line'
            }`}
          >
            <span className="text-xs">A</span><span className="text-base">A</span>
          </button>
          {typeOpen && (
            <>
              {/* Click-away backdrop closes the panel. */}
              <div className="fixed inset-0 z-20" onClick={() => setTypeOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-full z-30 mt-2">
                <TypePanel
                  fontSize={fontSize} lineHeight={lineHeight} margin={margin} theme={theme}
                  onFontSize={onFontSize} onLineHeight={onLineHeight} onMargin={onMargin} onTheme={onSetTheme}
                />
              </div>
            </>
          )}
        </div>
      </div>
      {/* Location context: where in the book (chapter) + a seekable progress bar. */}
      {total > 0 && (
        <div className="flex items-center gap-3 px-3 pb-2 sm:px-4">
          {chapter && (
            <span className="max-w-[45%] shrink-0 truncate text-xs text-ink-soft" title={chapter}>{chapter}</span>
          )}
          <ReadingProgressBar current={current} total={total} onSeek={onSeek} />
        </div>
      )}
    </div>
  )
}
