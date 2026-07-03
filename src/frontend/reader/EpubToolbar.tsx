import type { EpubTheme } from './EpubViewer'
import { PanelIcon } from './icons'

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
  onToggleToc: () => void
  onBack: () => void
}

export function EpubToolbar({
  fontSize, theme, current, total, onPrev, onNext, onFontSmaller, onFontLarger,
  onCycleTheme, onToggleToc, onBack,
}: EpubToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-blue-600">← Library</button>
        <button
          type="button"
          onClick={onToggleToc}
          className="flex items-center gap-1.5 rounded border px-2 py-1"
        >
          <PanelIcon /> Menu
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous" onClick={onPrev} className="rounded border px-2 py-1">‹</button>
        {total > 0
          ? <span className="text-gray-500">{current} / {total}</span>
          : <span className="text-gray-400" title="Calculating pages…">…</span>}
        <button type="button" aria-label="Next" onClick={onNext} className="rounded border px-2 py-1">›</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Smaller font" onClick={onFontSmaller} className="rounded border px-2 py-1">A−</button>
        <span>{fontSize}%</span>
        <button type="button" aria-label="Larger font" onClick={onFontLarger} className="rounded border px-2 py-1">A+</button>
        <button type="button" aria-label="Change theme" onClick={onCycleTheme} className="rounded border px-2 py-1 capitalize">{theme}</button>
      </div>
    </div>
  )
}
