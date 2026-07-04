import { expect, test } from 'vitest'
import { swipeDirection } from './swipe'

test('a leftward horizontal drag is a left (next) swipe', () => {
  expect(swipeDirection({ x: 300, y: 100 }, { x: 200, y: 110 }, 200)).toBe('left')
})

test('a rightward horizontal drag is a right (prev) swipe', () => {
  expect(swipeDirection({ x: 100, y: 100 }, { x: 220, y: 90 }, 200)).toBe('right')
})

test('a short movement is a tap, not a swipe', () => {
  expect(swipeDirection({ x: 100, y: 100 }, { x: 120, y: 100 }, 100)).toBeNull()
})

test('a mostly-vertical drag (scroll) is not a swipe', () => {
  expect(swipeDirection({ x: 100, y: 100 }, { x: 160, y: 260 }, 200)).toBeNull()
})

test('a slow drag past the time limit is not a swipe', () => {
  expect(swipeDirection({ x: 300, y: 100 }, { x: 180, y: 100 }, 1200)).toBeNull()
})
