import { beforeEach, expect, test } from 'vitest'
import { loadReaderSettings, saveReaderSettings } from './readerSettings'

beforeEach(() => localStorage.clear())

test('returns defaults when nothing is stored', () => {
  expect(loadReaderSettings()).toEqual({ fontSize: 100, theme: 'light' })
})

test('round-trips saved settings', () => {
  saveReaderSettings({ fontSize: 130, theme: 'dark' })
  expect(loadReaderSettings()).toEqual({ fontSize: 130, theme: 'dark' })
})

test('falls back to defaults on corrupt storage', () => {
  localStorage.setItem('reader.settings', 'not json')
  expect(loadReaderSettings()).toEqual({ fontSize: 100, theme: 'light' })
})
