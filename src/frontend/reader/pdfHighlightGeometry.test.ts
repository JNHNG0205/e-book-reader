import { expect, test } from 'vitest'
import { clientRectsToNormalized } from './pdfHighlightGeometry'

const page = { left: 100, top: 200, width: 400, height: 800 }

test('normalizes a client rect relative to the page', () => {
  const rects = clientRectsToNormalized(
    [{ left: 100, top: 200, width: 200, height: 40 }],
    page,
  )
  expect(rects).toEqual([{ x: 0, y: 0, w: 0.5, h: 0.05 }])
})

test('normalizes an offset rect', () => {
  const rects = clientRectsToNormalized(
    [{ left: 300, top: 600, width: 100, height: 80 }],
    page,
  )
  expect(rects).toEqual([{ x: 0.5, y: 0.5, w: 0.25, h: 0.1 }])
})

test('returns empty for a zero-size page', () => {
  expect(clientRectsToNormalized([{ left: 0, top: 0, width: 10, height: 10 }],
    { left: 0, top: 0, width: 0, height: 0 })).toEqual([])
})
