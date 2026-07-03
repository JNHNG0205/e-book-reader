export interface SearchResult {
  id: string
  location: string
  excerpt: string
  label?: string
}

// Max matches a whole-book search returns, so a common word can't flood the UI or hang the
// page. Shared by the EPUB/PDF search so the panel can note when results are truncated.
export const SEARCH_LIMIT = 200
