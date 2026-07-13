import { beforeEach, expect, test } from 'vitest'
import { loadReaderSettings, saveReaderSettings } from './readerSettings'

beforeEach(() => localStorage.clear())

test('returns defaults when nothing is stored', () => {
  expect(loadReaderSettings()).toEqual({ fontSize: 100, theme: 'light', lineHeight: 1.5, margin: 6 })
})

test('round-trips saved settings', () => {
  saveReaderSettings({ fontSize: 130, theme: 'dark', lineHeight: 1.8, margin: 10 })
  expect(loadReaderSettings()).toEqual({ fontSize: 130, theme: 'dark', lineHeight: 1.8, margin: 10 })
})

test('fills in defaults for older settings missing the newer fields', () => {
  localStorage.setItem('reader.settings', JSON.stringify({ fontSize: 120, theme: 'sepia' }))
  expect(loadReaderSettings()).toEqual({ fontSize: 120, theme: 'sepia', lineHeight: 1.5, margin: 6 })
})

test('clamps out-of-range line height and margin', () => {
  saveReaderSettings({ fontSize: 100, theme: 'light', lineHeight: 9, margin: 99 })
  const loaded = loadReaderSettings()
  expect(loaded.lineHeight).toBe(2.2)
  expect(loaded.margin).toBe(16)
})

test('falls back to defaults on corrupt storage', () => {
  localStorage.setItem('reader.settings', 'not json')
  expect(loadReaderSettings()).toEqual({ fontSize: 100, theme: 'light', lineHeight: 1.5, margin: 6 })
})
