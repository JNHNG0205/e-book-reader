import { useState, type FormEvent } from 'react'
import type { SearchResult } from './searchTypes'

interface SearchPanelProps {
  onSearch: (query: string) => Promise<SearchResult[]>
  onJump: (result: SearchResult) => void
}

type Status = 'idle' | 'searching' | 'done'

export function SearchPanel({ onSearch, onJump }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<SearchResult[]>([])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || status === 'searching') return
    setStatus('searching')
    try {
      setResults(await onSearch(q))
    } finally {
      setStatus('done')
    }
  }

  return (
    <div className="flex flex-col p-2">
      <form onSubmit={submit} className="flex gap-1">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this book…"
          className="min-w-0 flex-1 rounded border px-2 py-1 text-sm"
        />
        <button type="submit" aria-label="Search" className="rounded bg-black px-2 py-1 text-sm text-white">
          Search
        </button>
      </form>
      <div className="mt-2">
        {status === 'searching' && <p className="text-sm text-gray-500">Searching…</p>}
        {status === 'done' && results.length === 0 && (
          <p className="text-sm text-gray-500">No results.</p>
        )}
        {status === 'idle' && <p className="text-sm text-gray-400">Search this book.</p>}
        <ul className="flex flex-col gap-1">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onJump(r)}
                className="w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-100"
              >
                {r.label && <span className="mr-1 font-medium text-gray-500">{r.label}</span>}
                <span className="text-gray-800">{r.excerpt}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
