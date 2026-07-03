import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

test('clicking an overlay reports the highlight id', async () => {
  const onHighlightClick = vi.fn()
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}}
      highlights={[{ id: 'h1', color: 'yellow', rects: [{ x: 0, y: 0, w: 0.3, h: 0.05 }] }]}
      onHighlightClick={onHighlightClick} />,
  )
  const overlay = container.querySelector('[data-highlight-id="h1"]') as HTMLElement
  await userEvent.click(overlay)
  expect(onHighlightClick).toHaveBeenCalledWith('h1', expect.any(Number), expect.any(Number))
})
