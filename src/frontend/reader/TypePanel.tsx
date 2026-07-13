import type { EpubTheme } from './EpubViewer'
import { FONT_RANGE, LINE_HEIGHT_RANGE, MARGIN_RANGE } from './readerSettings'
import { MinusIcon, PlusIcon } from './icons'

const THEMES: { key: EpubTheme; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'dark', label: 'Dark' },
]

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function Stepper({
  label, value, onMinus, onPlus, minusLabel, plusLabel, minusDisabled, plusDisabled,
}: {
  label: string
  value: string
  onMinus: () => void
  onPlus: () => void
  minusLabel: string
  plusLabel: string
  minusDisabled: boolean
  plusDisabled: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button" aria-label={minusLabel} onClick={onMinus} disabled={minusDisabled}
          className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink-soft hover:bg-line-soft disabled:opacity-40"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <span className="w-12 text-center font-mono text-xs tabular-nums text-ink-soft">{value}</span>
        <button
          type="button" aria-label={plusLabel} onClick={onPlus} disabled={plusDisabled}
          className="grid h-7 w-7 place-items-center rounded-md border border-line text-ink-soft hover:bg-line-soft disabled:opacity-40"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Typography settings surface: font size, line spacing, page margins and theme. Shown in a
// popover under the toolbar's "Aa" button so the controls don't crowd the reading chrome.
export function TypePanel({
  fontSize, lineHeight, margin, theme, onFontSize, onLineHeight, onMargin, onTheme,
}: {
  fontSize: number
  lineHeight: number
  margin: number
  theme: EpubTheme
  onFontSize: (n: number) => void
  onLineHeight: (n: number) => void
  onMargin: (n: number) => void
  onTheme: (t: EpubTheme) => void
}) {
  return (
    <div
      role="dialog"
      aria-label="Text settings"
      className="flex w-60 flex-col gap-3 rounded-xl border border-line bg-paper-raised p-4 shadow-[0_12px_32px_-12px_rgba(27,26,23,0.5)]"
    >
      <Stepper
        label="Font size" value={`${fontSize}%`}
        minusLabel="Smaller font" plusLabel="Larger font"
        minusDisabled={fontSize <= FONT_RANGE.min} plusDisabled={fontSize >= FONT_RANGE.max}
        onMinus={() => onFontSize(clamp(fontSize - FONT_RANGE.step, FONT_RANGE.min, FONT_RANGE.max))}
        onPlus={() => onFontSize(clamp(fontSize + FONT_RANGE.step, FONT_RANGE.min, FONT_RANGE.max))}
      />
      <Stepper
        label="Line spacing" value={lineHeight.toFixed(1)}
        minusLabel="Less line spacing" plusLabel="More line spacing"
        minusDisabled={lineHeight <= LINE_HEIGHT_RANGE.min} plusDisabled={lineHeight >= LINE_HEIGHT_RANGE.max}
        onMinus={() => onLineHeight(round1(clamp(lineHeight - LINE_HEIGHT_RANGE.step, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max)))}
        onPlus={() => onLineHeight(round1(clamp(lineHeight + LINE_HEIGHT_RANGE.step, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max)))}
      />
      <Stepper
        label="Margins" value={`${margin}%`}
        minusLabel="Narrower margins" plusLabel="Wider margins"
        minusDisabled={margin <= MARGIN_RANGE.min} plusDisabled={margin >= MARGIN_RANGE.max}
        onMinus={() => onMargin(clamp(margin - MARGIN_RANGE.step, MARGIN_RANGE.min, MARGIN_RANGE.max))}
        onPlus={() => onMargin(clamp(margin + MARGIN_RANGE.step, MARGIN_RANGE.min, MARGIN_RANGE.max))}
      />
      <div className="flex flex-col gap-1.5">
        <span className="u-label">Theme</span>
        <div className="flex gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-label={`${t.label} theme`}
              aria-pressed={theme === t.key}
              onClick={() => onTheme(t.key)}
              className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium ${
                theme === t.key
                  ? 'border-accent bg-accent-tint text-accent-deep'
                  : 'border-line text-ink-soft hover:bg-line-soft'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
