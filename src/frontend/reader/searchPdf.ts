import { pdfjs } from 'react-pdf'
import type { SearchResult } from './searchTypes'

const LIMIT = 200
const CONTEXT = 60

function excerptAround(text: string, idx: number, len: number): string {
  const start = Math.max(0, idx - CONTEXT)
  const end = Math.min(text.length, idx + len + CONTEXT)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

export async function searchPdf(fileUrl: string, query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const pdf = await pdfjs.getDocument(fileUrl).promise
  try {
    const out: SearchResult[] = []
    for (let page = 1; page <= pdf.numPages; page++) {
      if (out.length >= LIMIT) break
      const content = await pdf.getPage(page).then((p) => p.getTextContent())
      const text = content.items.map((i) => ('str' in i ? i.str : '')).join(' ')
      const lower = text.toLowerCase()
      let idx = lower.indexOf(q)
      while (idx !== -1 && out.length < LIMIT) {
        out.push({
          id: `${page}-${idx}`,
          location: String(page),
          excerpt: excerptAround(text, idx, q.length),
          label: `Page ${page}`,
        })
        idx = lower.indexOf(q, idx + q.length)
      }
    }
    return out
  } finally {
    pdf.destroy()
  }
}
