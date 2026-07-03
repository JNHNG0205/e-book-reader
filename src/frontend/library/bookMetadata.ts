import ePub from 'epubjs'
import { pdfjs } from 'react-pdf'
import type { BookFormat } from '@shared/types'

export interface BookMetadata {
  title: string | null
  author: string | null
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function extractEpubMetadata(buffer: ArrayBuffer): Promise<BookMetadata> {
  const book = ePub(buffer)
  try {
    const meta = (await book.loaded.metadata) as { title?: string; creator?: string }
    return { title: clean(meta.title), author: clean(meta.creator) }
  } finally {
    book.destroy()
  }
}

async function extractPdfMetadata(buffer: ArrayBuffer): Promise<BookMetadata> {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
  const { info } = (await pdf.getMetadata()) as {
    info: { Title?: string; Author?: string }
  }
  return { title: clean(info.Title), author: clean(info.Author) }
}

export async function extractBookMetadata(
  buffer: ArrayBuffer,
  format: BookFormat,
): Promise<BookMetadata> {
  try {
    if (format === 'epub') return await extractEpubMetadata(buffer)
    if (format === 'pdf') return await extractPdfMetadata(buffer)
    return { title: null, author: null }
  } catch {
    return { title: null, author: null }
  }
}
