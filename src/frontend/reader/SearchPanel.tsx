import { useState, type FormEvent } from 'react'
import { SEARCH_LIMIT, type SearchResult } from './searchTypes'

interface SearchPanelProps {
  onSearch: (query: string) => Promise<SearchResult[]>
  onJump: (result: SearchResult) => void
}

type Status = 'idle' | 'searching' | 'done' | 'error'

export function SearchPanel({ onSearch, onJump }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<SearchResult[]>([])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || status === 'searching') return
    setResults([]) // clear the previous query's rows while the new search runs
    setStatus('searching')
    try {
      setResults(await onSearch(q))
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col p-2">
      <form onSubmit={submit} className="flex gap-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this book…"
          className="min-w-0 flex-1 rounded-md border border-line bg-paper px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
        <button type="submit" aria-label="Search" className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-deep">
          Search
        </button>
      </form>
      <div className="mt-2">
        {status === 'searching' && <p className="text-sm text-ink-soft">Searching…</p>}
        {status === 'error' && <p className="text-sm text-red-700">Search failed. Try again.</p>}
        {status === 'done' && results.length === 0 && (
          <p className="text-sm text-ink-soft">No results.</p>
        )}
        {status === 'idle' && <p className="text-sm text-ink-faint">Search this book.</p>}
        {status === 'done' && results.length >= SEARCH_LIMIT && (
          <p className="mb-1 text-xs text-ink-faint">Showing the first {SEARCH_LIMIT} matches.</p>
        )}
        <ul className="flex flex-col gap-0.5">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onJump(r)}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-line-soft"
              >
                {r.label && <span className="mr-1.5 font-mono text-xs font-medium text-accent">{r.label}</span>}
                <span className="text-ink">{r.excerpt}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
