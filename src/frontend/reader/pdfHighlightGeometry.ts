export interface NormRect {
  x: number
  y: number
  w: number
  h: number
}

interface Rectish {
  left: number
  top: number
  width: number
  height: number
}

// Converts viewport client rects (e.g. from a text-selection Range) to fractions of the
// page's own box, so a highlight survives zoom and re-render (overlays position by %).
export function clientRectsToNormalized(clientRects: Rectish[], pageRect: Rectish): NormRect[] {
  if (pageRect.width === 0 || pageRect.height === 0) return []
  return clientRects.map((r) => ({
    x: (r.left - pageRect.left) / pageRect.width,
    y: (r.top - pageRect.top) / pageRect.height,
    w: r.width / pageRect.width,
    h: r.height / pageRect.height,
  }))
}
