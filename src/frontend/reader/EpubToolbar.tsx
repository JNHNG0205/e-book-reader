import type { EpubTheme } from './EpubViewer'

export interface EpubToolbarProps {
  fontSize: number
  theme: EpubTheme
  current: number
  total: number
  onPrev: () => void
  onNext: () => void
  onFontSmaller: () => void
  onFontLarger: () => void
  onCycleTheme: () => void
  onBack: () => void
}

export function EpubToolbar({
  fontSize, theme, current, total, onPrev, onNext, onFontSmaller, onFontLarger,
  onCycleTheme, onBack,
}: EpubToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line bg-paper-raised px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-deep">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5"><path d="M15 18l-6-6 6-6" /></svg>
          Library
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-full border border-line px-1.5 py-0.5">
        <button type="button" aria-label="Previous" onClick={onPrev} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        {total > 0
          ? <span className="min-w-[4.5rem] text-center font-mono text-[0.8125rem] tabular-nums text-ink">{current} / {total}</span>
          : <span className="min-w-[4.5rem] text-center text-ink-faint" title="Calculating pages…">…</span>}
        <button type="button" aria-label="Next" onClick={onNext} className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-line-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Smaller font" onClick={onFontSmaller} className="grid h-8 w-8 place-items-center rounded-md border border-line font-serif text-xs text-ink-soft hover:bg-line-soft">A</button>
        <span className="w-11 text-center font-mono text-xs tabular-nums text-ink-soft">{fontSize}%</span>
        <button type="button" aria-label="Larger font" onClick={onFontLarger} className="grid h-8 w-8 place-items-center rounded-md border border-line font-serif text-base text-ink-soft hover:bg-line-soft">A</button>
        <button type="button" aria-label="Change theme" onClick={onCycleTheme} className="h-8 rounded-md border border-line px-2.5 text-xs font-medium capitalize text-ink-soft hover:bg-line-soft">{theme}</button>
      </div>
    </div>
  )
}
