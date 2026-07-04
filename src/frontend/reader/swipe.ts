// Classifies a touch gesture as a horizontal page-turn swipe, or null if it was a tap,
// a vertical scroll, or too slow/short to count. Kept pure so it's unit-testable — the
// readers feed it the start/end touch points and duration.
export interface Point { x: number; y: number }

const MIN_DISTANCE = 50 // px a finger must travel horizontally
const MAX_OFF_AXIS = 0.6 // |dy| must stay under this fraction of |dx| (mostly horizontal)
const MAX_DURATION = 700 // ms — a slow drag isn't a swipe

export function swipeDirection(start: Point, end: Point, durationMs: number): 'left' | 'right' | null {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (durationMs > MAX_DURATION) return null
  if (Math.abs(dx) < MIN_DISTANCE) return null
  if (Math.abs(dy) > Math.abs(dx) * MAX_OFF_AXIS) return null
  return dx < 0 ? 'left' : 'right'
}
