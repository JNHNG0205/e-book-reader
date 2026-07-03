import type { EpubTheme } from './EpubViewer'

export interface ReaderSettings {
  fontSize: number
  theme: EpubTheme
}

const KEY = 'reader.settings'
const DEFAULTS: ReaderSettings = { fontSize: 100, theme: 'light' }
const THEMES: EpubTheme[] = ['light', 'dark', 'sepia']

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    const fontSize = typeof parsed.fontSize === 'number' ? parsed.fontSize : DEFAULTS.fontSize
    const theme = parsed.theme && THEMES.includes(parsed.theme) ? parsed.theme : DEFAULTS.theme
    return { fontSize, theme }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveReaderSettings(s: ReaderSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore quota errors */ }
}
