export type BookFormat = 'pdf' | 'epub'

export interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  format: BookFormat
  storage_path: string
  cover_path: string | null
  total_pages: number | null
  created_at: string
  updated_at: string
}

export interface ReadingProgress {
  id: string
  user_id: string
  book_id: string
  location: string // PDF: page number as string; EPUB: CFI
  updated_at: string
}

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  color: string
  note: string | null
  anchor: Record<string, unknown> // PDF: {page,rects,text}; EPUB: {cfiRange,text}
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  user_id: string
  book_id: string
  location: string
  label: string | null
  created_at: string
  updated_at: string
}
