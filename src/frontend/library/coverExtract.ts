import ePub from 'epubjs'
import { pdfjs } from 'react-pdf'
import type { BookFormat } from '@shared/types'

// Configure the PDF.js worker (Vite resolves this URL at build time). Same
// setup as PdfViewer; setting it twice is harmless since it's idempotent.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

async function extractEpubCover(buffer: ArrayBuffer): Promise<Blob | null> {
  const book = ePub(buffer)
  try {
    const url = (await book.coverUrl()) as string | null
    if (!url) return null
    const response = await fetch(url)
    return await response.blob()
  } finally {
    book.destroy()
  }
}

async function extractPdfCover(buffer: ArrayBuffer): Promise<Blob | null> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 1 })
  const scale = 600 / Math.max(viewport.width, viewport.height)
  const scaledViewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  await page.render({ canvas, canvasContext: ctx, viewport: scaledViewport }).promise

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.8)
  })
}

export async function extractCoverBlob(
  buffer: ArrayBuffer,
  format: BookFormat,
): Promise<Blob | null> {
  try {
    if (format === 'epub') return await extractEpubCover(buffer)
    if (format === 'pdf') return await extractPdfCover(buffer)
    return null
  } catch {
    return null
  }
}
