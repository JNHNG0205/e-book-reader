import { Document, Page, pdfjs } from 'react-pdf'

// Configure the PDF.js worker (Vite resolves this URL at build time).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfViewerProps {
  fileUrl: string
  pageNumber: number
  scale: number
  onNumPages: (n: number) => void
}

export function PdfViewer({ fileUrl, pageNumber, scale, onNumPages }: PdfViewerProps) {
  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => onNumPages(numPages)}
      loading={<div className="p-8 text-gray-500">Loading PDF…</div>}
      error={<div className="p-8 text-red-600">Failed to load PDF.</div>}
    >
      <Page
        pageNumber={pageNumber}
        scale={scale}
        renderTextLayer={false}
        renderAnnotationLayer={false}
      />
    </Document>
  )
}
