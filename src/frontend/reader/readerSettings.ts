import type { EpubTheme } from './EpubViewer'

export interface ReaderSettings {
  fontSize: number
  theme: EpubTheme
  // Line spacing multiplier applied to the book text (e.g. 1.5 = 150%).
  lineHeight: number
  // Horizontal page margin, as a percentage of the reading column width (per side).
  margin: number
}

const KEY = 'reader.settings'
const DEFAULTS: ReaderSettings = { fontSize: 100, theme: 'light', lineHeight: 1.5, margin: 6 }
const THEMES: EpubTheme[] = ['light', 'dark', 'sepia']

// Clamp bounds, shared with the type panel's steppers so stored values stay in range.
export const FONT_RANGE = { min: 70, max: 200, step: 10 }
export const LINE_HEIGHT_RANGE = { min: 1.2, max: 2.2, step: 0.1 }
export const MARGIN_RANGE = { min: 0, max: 16, step: 2 }

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    const fontSize = typeof parsed.fontSize === 'number' ? parsed.fontSize : DEFAULTS.fontSize
    const theme = parsed.theme && THEMES.includes(parsed.theme) ? parsed.theme : DEFAULTS.theme
    const lineHeight = typeof parsed.lineHeight === 'number'
      ? clamp(parsed.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max) : DEFAULTS.lineHeight
    const margin = typeof parsed.margin === 'number'
      ? clamp(parsed.margin, MARGIN_RANGE.min, MARGIN_RANGE.max) : DEFAULTS.margin
    return { fontSize, theme, lineHeight, margin }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveReaderSettings(s: ReaderSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore quota errors */ }
}
