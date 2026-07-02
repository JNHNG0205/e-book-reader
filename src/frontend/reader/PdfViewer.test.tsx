import { render, screen } from '@testing-library/react'
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
