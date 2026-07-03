import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  Document: ({ children, onLoadSuccess }: {
    children: React.ReactNode
    onLoadSuccess?: (p: { numPages: number }) => void
  }) => {
    onLoadSuccess?.({ numPages: 5 })
    return <div data-testid="pdf-document">{children}</div>
  },
  Page: ({ pageNumber, scale }: { pageNumber: number; scale: number }) => (
    <div data-testid="pdf-page">page {pageNumber} @ {scale}</div>
  ),
}))

import { PdfViewer } from './PdfViewer'

test('renders the requested page at the given scale', () => {
  render(<PdfViewer fileUrl="https://x/y.pdf" pageNumber={3} scale={1.5} onNumPages={() => {}} />)
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 3 @ 1.5')
})

test('reports the total page count on document load', () => {
  const onNumPages = vi.fn()
  render(<PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={onNumPages} />)
  expect(onNumPages).toHaveBeenCalledWith(5)
})

test('renders highlight overlays as percentage-positioned boxes', () => {
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}}
      highlights={[{ id: 'h1', color: 'yellow', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }] }]} />,
  )
  const overlay = container.querySelector('[data-highlight-id="h1"]') as HTMLElement
  expect(overlay).not.toBeNull()
  expect(overlay.style.left).toBe('10%')
  expect(overlay.style.width).toBe('30%')
})

test('reports a text selection on mouseup', async () => {
  const onSelect = vi.fn()
  // Stub the selection + the wrapper geometry.
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    toString: () => 'picked text',
    getRangeAt: () => ({
      getClientRects: () => [{ left: 100, top: 200, width: 200, height: 40 }],
    }),
  } as unknown as Selection)
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}} onSelect={onSelect} />,
  )
  const wrapper = container.querySelector('[data-pdf-page-wrapper]') as HTMLElement
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200, width: 400, height: 800 } as DOMRect)
  wrapper.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    text: 'picked text',
    rects: [{ x: 0, y: 0, w: 0.5, h: 0.05 }],
  }))
  vi.restoreAllMocks()
})

test('clicking inside a highlight rect reports the highlight id (hit-test)', async () => {
  const onHighlightClick = vi.fn()
  // The overlay is pointer-events:none; the wrapper hit-tests the click against the rects.
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: true } as unknown as Selection)
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}}
      highlights={[{ id: 'h1', color: 'yellow', rects: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.1 }] }]}
      onHighlightClick={onHighlightClick} />,
  )
  const wrapper = container.querySelector('[data-pdf-page-wrapper]') as HTMLElement
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 800 } as DOMRect)
  // Click at (80, 120): nx=0.2, ny=0.15 — inside the rect [0.1..0.4, 0.1..0.2].
  fireEvent.click(wrapper, { clientX: 80, clientY: 120 })
  expect(onHighlightClick).toHaveBeenCalledWith('h1', 80, 120)
  vi.restoreAllMocks()
})

test('clicking outside every highlight rect reports nothing', async () => {
  const onHighlightClick = vi.fn()
  vi.spyOn(window, 'getSelection').mockReturnValue({ isCollapsed: true } as unknown as Selection)
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}}
      highlights={[{ id: 'h1', color: 'yellow', rects: [{ x: 0.1, y: 0.1, w: 0.3, h: 0.1 }] }]}
      onHighlightClick={onHighlightClick} />,
  )
  const wrapper = container.querySelector('[data-pdf-page-wrapper]') as HTMLElement
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 800 } as DOMRect)
  fireEvent.click(wrapper, { clientX: 360, clientY: 700 })
  expect(onHighlightClick).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})
