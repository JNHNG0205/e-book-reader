# Milestone 5: In-Book Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search the full text of the open book and jump to any match. A **Search** tab in the reader sidebar (both formats) with a query box; on submit it searches the whole book and lists matches (excerpt + location); clicking a result jumps there.

**Architecture:** One shared, format-agnostic `SearchPanel` (input + results list + jump) rendered as a sidebar tab. Each reader supplies an `onSearch(query) → Promise<SearchResult[]>` and an `onJump(result)`:
- **EPUB** — `EpubViewer` gains a `search(query)` handle method that iterates the spine (`book.spine.spineItems`), loads each section, runs epub.js's `section.find(query)` (returns `{cfi, excerpt}`), and unloads it. Jump = `goTo(cfi)`.
- **PDF** — a `searchPdf(fileUrl, query)` util loads the doc via pdfjs, reads each page's `getTextContent()`, finds matches, and returns `{ location: pageNumber, excerpt }`. Jump = `setPage(n)`.

**Tech Stack:** existing React 19 / Vite / TS / Tailwind / Supabase / Vitest + epubjs + pdfjs (via react-pdf).

## Global Constraints

- Search is **on submit** (Enter / search button), NOT per keystroke — whole-book search is expensive. Show a "Searching…" state; disable double-submit.
- `SearchResult = { id: string; location: string; excerpt: string; label?: string }`. `location` is opaque to the panel (EPUB CFI string or PDF page-as-string); the reader's `onJump` interprets it.
- Cap results to a sane maximum (e.g. 200) and note when truncated, so a common word doesn't produce thousands of rows or hang the UI.
- EPUB search must **unload each section** after searching it (`item.unload()`), even on error, so memory doesn't balloon.
- PDF search loads a **separate** pdfjs document (don't couple to react-pdf's internal one); `destroy()` it when done. pdfjs `getDocument(url)` is fine with the signed URL.
- Add the **Search** tab alongside the existing sidebar tabs (EPUB: Contents/Bookmarks/Highlights; PDF: Bookmarks/Highlights). Do not disturb existing tabs, reader features, or highlights/bookmarks.
- Folder split + alias imports; `vi.mock()` paths match import paths. TypeScript strict, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` green.

---

### Task 1: SearchResult type + SearchPanel component

**Files:**
- Create: `src/frontend/reader/SearchPanel.tsx`
- Create: `src/frontend/reader/searchTypes.ts`
- Test: `src/frontend/reader/SearchPanel.test.tsx`

**Interfaces:**
- `searchTypes.ts` exports `SearchResult = { id: string; location: string; excerpt: string; label?: string }`.
- `SearchPanel({ onSearch, onJump })`:
  - `onSearch: (query: string) => Promise<SearchResult[]>`
  - `onJump: (result: SearchResult) => void`
  - A form with a text input + submit; on submit (non-empty, trimmed) sets a "searching" flag, awaits `onSearch`, shows results. Renders: idle hint ("Search this book"), "Searching…", "No results" (empty after a search), or the results list. Each result is a button showing `label` (if any) + `excerpt`; click → `onJump(result)`.

- [ ] **Step 1: Write the failing test**

Create `src/frontend/reader/SearchPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SearchPanel } from './SearchPanel'
import type { SearchResult } from './searchTypes'

const results: SearchResult[] = [
  { id: '1', location: 'epubcfi(/6/4!/4/2)', excerpt: '…the whale surfaced…', label: 'Ch. 1' },
  { id: '2', location: 'epubcfi(/6/8!/4/2)', excerpt: '…a second whale…', label: 'Ch. 2' },
]

test('searches on submit and lists results', async () => {
  const onSearch = vi.fn().mockResolvedValue(results)
  render(<SearchPanel onSearch={onSearch} onJump={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), 'whale')
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  expect(onSearch).toHaveBeenCalledWith('whale')
  expect(await screen.findByText(/the whale surfaced/)).toBeInTheDocument()
  expect(screen.getByText(/a second whale/)).toBeInTheDocument()
})

test('clicking a result jumps to it', async () => {
  const onJump = vi.fn()
  render(<SearchPanel onSearch={vi.fn().mockResolvedValue(results)} onJump={onJump} />)
  await userEvent.type(screen.getByRole('textbox'), 'whale')
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  await userEvent.click(await screen.findByText(/the whale surfaced/))
  expect(onJump).toHaveBeenCalledWith(results[0])
})

test('shows an empty state when nothing matches', async () => {
  render(<SearchPanel onSearch={vi.fn().mockResolvedValue([])} onJump={() => {}} />)
  await userEvent.type(screen.getByRole('textbox'), 'zzz')
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  expect(await screen.findByText(/no results/i)).toBeInTheDocument()
})

test('does not search a blank query', async () => {
  const onSearch = vi.fn()
  render(<SearchPanel onSearch={onSearch} onJump={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /search/i }))
  expect(onSearch).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run — verify it fails.** `bun run test src/frontend/reader/SearchPanel.test.tsx` → FAIL (modules missing).

- [ ] **Step 3: Implement**

Create `src/frontend/reader/searchTypes.ts`:
```ts
export interface SearchResult {
  id: string
  location: string
  excerpt: string
  label?: string
}
```

Create `src/frontend/reader/SearchPanel.tsx`:
```tsx
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
```

- [ ] **Step 4: Run — verify it passes.** `bun run test src/frontend/reader/SearchPanel.test.tsx` → PASS (4 tests).

- [ ] **Step 5: Commit.** `git add -A && git commit -m "feat: add SearchPanel (query, results, jump) + SearchResult type"`

---

### Task 2: EPUB search — EpubViewer.search + Search sidebar tab

**Files:**
- Modify: `src/frontend/reader/EpubViewer.tsx`
- Modify: `src/frontend/reader/EpubReader.tsx`
- Test: `src/frontend/reader/EpubViewer.test.tsx` + `src/frontend/reader/EpubReader.test.tsx`

**Interfaces:**
- `EpubViewerHandle` gains `search(query: string): Promise<SearchResult[]>` — iterates `book.spine.spineItems`, `await item.load(book.load.bind(book))`, runs `item.find(query)` → `{cfi, excerpt}`, maps to `SearchResult` (`id`+`location` = cfi, `excerpt`), then `item.unload()` in a `finally`. Caps total at 200 results (stop early). Returns `[]` if no book/blank query.
- `EpubReader` adds a **Search** tab to `ReaderSidebar` rendering `<SearchPanel onSearch={(q) => viewerRef.current?.search(q) ?? Promise.resolve([])} onJump={(r) => viewerRef.current?.goTo(r.location)} />`.

- [ ] **Step 1: Write failing tests**

In `EpubViewer.test.tsx`, extend the epub.js mock's `book` with a `spine.spineItems` array of fake sections (each with `load`, `unload`, `find` returning `[{cfi, excerpt}]`) and `book.load`. Add a test that calls the ref's `search('whale')` and asserts it returns mapped `SearchResult[]` and that `unload` was called per section. (Follow the existing pattern where the test grabs the imperative handle via a ref.)

In `EpubReader.test.tsx`, add a test: open the sidebar, click the **Search** tab, type a query, submit, and assert a result row appears (drive via the `EpubViewer` mock's `search` returning canned results), then click it and assert the mock's `goTo` was called with the result's location.

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement**

In `EpubViewer.tsx`, add to the `useImperativeHandle` object:
```ts
search: async (query: string): Promise<SearchResult[]> => {
  const book = bookRef.current
  const q = query.trim()
  if (!book || !q) return []
  const out: SearchResult[] = []
  const LIMIT = 200
  const items = (book.spine as unknown as { spineItems: Array<{
    href?: string
    load: (l: unknown) => Promise<unknown>
    unload: () => void
    find: (q: string) => Array<{ cfi: string; excerpt: string }>
  }> }).spineItems
  const loader = (book.load as unknown as { bind: (b: unknown) => unknown }).bind(book)
  for (const item of items) {
    if (out.length >= LIMIT) break
    try {
      await item.load(loader)
      for (const m of item.find(q)) {
        out.push({ id: m.cfi, location: m.cfi, excerpt: m.excerpt })
        if (out.length >= LIMIT) break
      }
    } catch {
      /* skip a section that fails to load */
    } finally {
      item.unload()
    }
  }
  return out
}
```
Add `search` to the `EpubViewerHandle` interface and `import type { SearchResult } from './searchTypes'`.

In `EpubReader.tsx`, add the Search tab to the sidebar `tabs` array (after Highlights):
```tsx
{ key: 'search', label: 'Search', render: () => (
  <SearchPanel
    onSearch={(q) => viewerRef.current?.search(q) ?? Promise.resolve([])}
    onJump={(r) => viewerRef.current?.goTo(r.location)}
  />
) }
```
Import `SearchPanel`.

- [ ] **Step 4: Run — verify pass.** Full file tests green.

- [ ] **Step 5: Full suite + build.** `bun run test && bun run build` → green.

- [ ] **Step 6: Commit.** `git commit -m "feat: EPUB full-book search + Search sidebar tab"`

---

### Task 3: PDF search — searchPdf util + Search sidebar tab

**Files:**
- Create: `src/frontend/reader/searchPdf.ts`
- Test: `src/frontend/reader/searchPdf.test.ts`
- Modify: `src/frontend/pages/ReaderPage.tsx`
- Test: `src/frontend/pages/ReaderPage.test.tsx`

**Interfaces:**
- `searchPdf(fileUrl: string, query: string): Promise<SearchResult[]>` — loads via `pdfjs.getDocument(fileUrl)`, for each page joins `getTextContent()` items' `.str`, finds all (case-insensitive) matches, pushes `{ id: '<page>-<idx>', location: String(page), excerpt: <±60 chars around the match>, label: 'Page <page>' }`, caps total at 200, `pdf.destroy()` in `finally`. Blank query → `[]`.
- `ReaderPage` (PDF branch) adds a **Search** tab: `<SearchPanel onSearch={(q) => searchPdf(fileUrl, q)} onJump={(r) => setPage(Number(r.location))} />`.

- [ ] **Step 1: Write failing tests**

Create `src/frontend/reader/searchPdf.test.ts` — mock `react-pdf`'s `pdfjs.getDocument` to return a doc with `numPages` and `getPage(n)` → `{ getTextContent: () => ({ items: [{ str: '…text…' }] }) }` and `destroy`. Assert: a query hits the right page(s) with a `location`/`label`, blank query returns `[]`, and `destroy` is called.

In `ReaderPage.test.tsx`, add a test (PDF book): open the sidebar, click **Search**, type + submit, and — with `searchPdf` mocked to return a canned result — click the result and assert the page changed (reuse the existing `pdf-page` testid that echoes the page).

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement**

Create `src/frontend/reader/searchPdf.ts`:
```ts
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
```

In `ReaderPage.tsx` (PDF branch), add the Search tab to the sidebar `tabs` array (after Highlights):
```tsx
{ key: 'search', label: 'Search', render: () => (
  <SearchPanel onSearch={(q) => searchPdf(fileUrl, q)} onJump={(r) => setPage(Number(r.location))} />
) }
```
Import `searchPdf` and `SearchPanel`.

- [ ] **Step 4: Run — verify pass.**

- [ ] **Step 5: Full suite + build.** `bun run test && bun run build` → green.

- [ ] **Step 6: Commit.** `git commit -m "feat: PDF full-book search + Search sidebar tab"`

---

## Self-Review

**Spec coverage (roadmap M5 — in-book search):**
- Whole-book text search, both formats → Task 2 (EPUB spine + `section.find`) + Task 3 (PDF per-page `getTextContent`). ✓
- Results with context excerpt + jump-to-location → Task 1 (`SearchPanel`) + reader `onJump` (EPUB `goTo(cfi)`, PDF `setPage`). ✓
- Search UI in the reader → Search tab in the shared `ReaderSidebar`, both formats. ✓

**Placeholder scan:** no TODOs; the one browser-version-dependent detail (pdfjs `getTextContent` item shape) is guarded with `'str' in i`.

**Type consistency:** `SearchResult` shared by `SearchPanel`, `EpubViewer.search`, and `searchPdf`; `location` is a string everywhere (CFI or page-as-string), interpreted only by each reader's `onJump`.

**Test isolation:** `SearchPanel` tested with a mocked `onSearch`; `EpubViewer.search` tested against a mocked epub.js spine; `searchPdf` tested against a mocked `pdfjs.getDocument`; the reader wiring tested with the viewer/util mocked. Real full-text search over a live book (relevance, speed on large books, CFI/page jump accuracy) is verified in the manual browser check: open a book → Search tab → query a known word → results list → click → jumps to the right place; blank/È no-match states; a very common word stays capped/responsive.

**Deferred (not in M5):** highlighting the matched text in-page (only jump-to-location here); incremental/as-you-type search; match navigation (next/prev) within the page.
