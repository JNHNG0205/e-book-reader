# Milestone 2: PDF Reader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the library, open a PDF and read it — exact-page rendering (PDF.js via react-pdf), page navigation, zoom, and reading position that saves and resumes.

**Architecture:** A new reader route `/read/:bookId`. Book file access + reading progress go through backend repositories (`@backend/data/*`); the reader UI lives under `@frontend/reader/` + a `ReaderPage`. PDF rendering is isolated in a `PdfViewer` component wrapping react-pdf, so it can be mocked in tests (react-pdf/pdf.js need a real canvas that jsdom lacks).

**Tech Stack:** react-pdf (wraps PDF.js / pdfjs-dist), plus the existing React 19 / Vite / TS / Tailwind / Supabase / Vitest stack.

## Global Constraints

- **Folder split + aliases:** UI under `src/frontend/` (`@frontend`), data-access under `src/backend/data/` (`@backend`), types in `@shared/types`. Import across layers via alias; test `vi.mock()` paths must match the import path exactly.
- **Repository pattern:** the reader UI reads book files and progress ONLY through `@backend/data/*`, never `@backend/supabase` directly.
- **EPUB is out of scope** for this milestone — the reader handles `format === 'pdf'`. An EPUB opened here shows a "not yet supported" placeholder (M3 adds it). Do not build EPUB rendering.
- **PDF location = page number as a string** (matches the `reading_progress.location` text column and `src/types.ts`).
- TypeScript strict ON, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` must stay green.
- **Text layer stays OFF in this milestone** (`renderTextLayer={false}`, `renderAnnotationLayer={false}`) — highlighting (which needs the text layer + its CSS) is Milestone 4. This keeps M2 free of react-pdf CSS setup.

---

### Task 1: Backend — single-book fetch, signed file URL, shared auth helper

**Files:**
- Create: `src/backend/data/currentUser.ts`
- Modify: `src/backend/data/books.ts`
- Test: `src/backend/data/books.test.ts` (extend)

**Interfaces:**
- Consumes: `supabase` (`@backend/supabase`), `Book` (`@shared/types`).
- Produces:
  - `currentUser.ts`: `requireUserId(): Promise<string>` (throws if unauthenticated).
  - `books.ts` adds: `getBook(id: string): Promise<Book>` and `getBookFileUrl(storagePath: string): Promise<string>` (a signed URL valid ~1h). `books.ts` is refactored to import `requireUserId` from `currentUser.ts` instead of its private copy.

- [ ] **Step 1: Extract the auth helper (write its test first)**

Create `src/backend/data/currentUser.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { auth: { getUser } } }))

import { requireUserId } from './currentUser'

beforeEach(() => vi.clearAllMocks())

test('returns the current user id', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  expect(await requireUserId()).toBe('u1')
})

test('throws when unauthenticated', async () => {
  getUser.mockResolvedValue({ data: { user: null } })
  await expect(requireUserId()).rejects.toThrow(/not authenticated/i)
})
```

- [ ] **Step 2: Run it — verify it fails**

Run: `bun run test src/backend/data/currentUser.test.ts`
Expected: FAIL — `./currentUser` not found.

- [ ] **Step 3: Implement the helper**

Create `src/backend/data/currentUser.ts`:
```ts
import { supabase } from '@backend/supabase'

export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}
```

- [ ] **Step 4: Run it — verify it passes**

Run: `bun run test src/backend/data/currentUser.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add getBook + getBookFileUrl tests**

Add to `src/backend/data/books.test.ts` (inside the existing file; the `from`/`storageFrom` hoisted mocks already exist there):
```ts
test('getBook returns the row for the id', async () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'b1', title: 'T' }, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) })
  const { getBook } = await import('./books')
  const book = await getBook('b1')
  expect(book).toEqual({ id: 'b1', title: 'T' })
})

test('getBookFileUrl returns a signed url for the storage path', async () => {
  const createSignedUrl = vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed/x.pdf' }, error: null,
  })
  storageFrom.mockReturnValue({ createSignedUrl })
  const { getBookFileUrl } = await import('./books')
  const url = await getBookFileUrl('u1/x.pdf')
  expect(url).toBe('https://signed/x.pdf')
  expect(createSignedUrl).toHaveBeenCalledWith('u1/x.pdf', 3600)
})
```

- [ ] **Step 6: Run — verify the new tests fail**

Run: `bun run test src/backend/data/books.test.ts`
Expected: FAIL — `getBook` / `getBookFileUrl` are not exported.

- [ ] **Step 7: Implement in books.ts and adopt the shared helper**

In `src/backend/data/books.ts`: delete the local `requireUserId` function and instead `import { requireUserId } from './currentUser'`. Add the two new exports:
```ts
export async function getBook(id: string): Promise<Book> {
  const { data, error } = await supabase.from('books').select('*').eq('id', id).single()
  if (error) throw error
  return data as Book
}

export async function getBookFileUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('books').createSignedUrl(storagePath, 3600)
  if (error) throw error
  return data.signedUrl
}
```

- [ ] **Step 8: Run the books suite + full suite**

Run: `bun run test src/backend/data/books.test.ts` then `bun run test`
Expected: all pass (existing books tests still green after the requireUserId refactor).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add getBook, getBookFileUrl, and shared requireUserId helper"
```

---

### Task 2: Backend — reading progress repository

**Files:**
- Create: `src/backend/data/progress.ts`
- Test: `src/backend/data/progress.test.ts`

**Interfaces:**
- Consumes: `supabase`, `requireUserId` (`./currentUser`).
- Produces:
  - `getProgress(bookId: string): Promise<string | null>` — the saved location, or null if none.
  - `saveProgress(bookId: string, location: string): Promise<void>` — upsert on `(user_id, book_id)`.

- [ ] **Step 1: Write the failing tests**

Create `src/backend/data/progress.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { from } }))
vi.mock('./currentUser', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { getProgress, saveProgress } from './progress'

beforeEach(() => vi.clearAllMocks())

test('getProgress returns the saved location', async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { location: '12' }, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) })
  expect(await getProgress('b1')).toBe('12')
})

test('getProgress returns null when there is no row', async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) })
  expect(await getProgress('b1')).toBeNull()
})

test('saveProgress upserts location for the user+book', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ upsert })
  await saveProgress('b1', '7')
  expect(upsert).toHaveBeenCalledWith(
    { user_id: 'u1', book_id: 'b1', location: '7' },
    { onConflict: 'user_id,book_id' },
  )
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/backend/data/progress.test.ts`
Expected: FAIL — `./progress` not found.

- [ ] **Step 3: Implement**

Create `src/backend/data/progress.ts`:
```ts
import { supabase } from '@backend/supabase'
import { requireUserId } from './currentUser'

export async function getProgress(bookId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('reading_progress')
    .select('location')
    .eq('book_id', bookId)
    .maybeSingle()
  if (error) throw error
  return data?.location ?? null
}

export async function saveProgress(bookId: string, location: string): Promise<void> {
  const userId = await requireUserId()
  const { error } = await supabase
    .from('reading_progress')
    .upsert({ user_id: userId, book_id: bookId, location }, { onConflict: 'user_id,book_id' })
  if (error) throw error
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/backend/data/progress.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add reading progress repository (get/save)"
```

---

### Task 3: react-pdf setup + PdfViewer component

**Files:**
- Modify: `package.json` (add `react-pdf`)
- Create: `src/frontend/reader/PdfViewer.tsx`
- Test: `src/frontend/reader/PdfViewer.test.tsx`

**Interfaces:**
- Consumes: `react-pdf` (`Document`, `Page`, `pdfjs`).
- Produces: `PdfViewer` with props `{ fileUrl: string; pageNumber: number; scale: number; onNumPages: (n: number) => void }`. Renders the page at the given scale; reports total pages via `onNumPages` on document load. Text/annotation layers OFF this milestone.

- [ ] **Step 1: Install react-pdf**

Run: `bun add react-pdf`
Expected: `react-pdf` (and its `pdfjs-dist` peer) in `package.json` / `bun.lock`.

- [ ] **Step 2: Write the failing test (react-pdf mocked)**

Create `src/frontend/reader/PdfViewer.test.tsx`:
```tsx
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
```

- [ ] **Step 3: Run — verify it fails**

Run: `bun run test src/frontend/reader/PdfViewer.test.tsx`
Expected: FAIL — `./PdfViewer` not found.

- [ ] **Step 4: Implement PdfViewer**

Create `src/frontend/reader/PdfViewer.tsx`:
```tsx
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
```

- [ ] **Step 5: Run — verify it passes**

Run: `bun run test src/frontend/reader/PdfViewer.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green. (The `import.meta.url` worker line must compile under Vite.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add PdfViewer component wrapping react-pdf"
```

---

### Task 4: Reader toolbar

**Files:**
- Create: `src/frontend/reader/ReaderToolbar.tsx`
- Test: `src/frontend/reader/ReaderToolbar.test.tsx`

**Interfaces:**
- Produces: `ReaderToolbar` with props `{ page: number; numPages: number; scale: number; onPrev: () => void; onNext: () => void; onZoomIn: () => void; onZoomOut: () => void; onBack: () => void }`. Shows "page / numPages", Prev disabled at page 1, Next disabled at the last page, zoom buttons, and a Back control.

- [ ] **Step 1: Write the failing test**

Create `src/frontend/reader/ReaderToolbar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ReaderToolbar } from './ReaderToolbar'

const baseProps = {
  page: 2, numPages: 10, scale: 1,
  onPrev: vi.fn(), onNext: vi.fn(), onZoomIn: vi.fn(), onZoomOut: vi.fn(), onBack: vi.fn(),
}

test('shows the current page and total', () => {
  render(<ReaderToolbar {...baseProps} />)
  expect(screen.getByText(/2\s*\/\s*10/)).toBeInTheDocument()
})

test('prev is disabled on the first page', () => {
  render(<ReaderToolbar {...baseProps} page={1} />)
  expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled()
})

test('next is disabled on the last page', () => {
  render(<ReaderToolbar {...baseProps} page={10} numPages={10} />)
  expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled()
})

test('fires callbacks on click', async () => {
  const onNext = vi.fn()
  render(<ReaderToolbar {...baseProps} onNext={onNext} />)
  await userEvent.click(screen.getByRole('button', { name: /next page/i }))
  expect(onNext).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/ReaderToolbar.test.tsx`
Expected: FAIL — `./ReaderToolbar` not found.

- [ ] **Step 3: Implement**

Create `src/frontend/reader/ReaderToolbar.tsx`:
```tsx
export interface ReaderToolbarProps {
  page: number
  numPages: number
  scale: number
  onPrev: () => void
  onNext: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onBack: () => void
}

export function ReaderToolbar({
  page, numPages, scale, onPrev, onNext, onZoomIn, onZoomOut, onBack,
}: ReaderToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-white px-4 py-2 text-sm">
      <button type="button" onClick={onBack} className="text-blue-600">← Library</button>
      <div className="flex items-center gap-2">
        <button
          type="button" aria-label="Previous page" onClick={onPrev} disabled={page <= 1}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >‹</button>
        <span>{page} / {numPages || '…'}</span>
        <button
          type="button" aria-label="Next page" onClick={onNext} disabled={page >= numPages}
          className="rounded border px-2 py-1 disabled:opacity-40"
        >›</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Zoom out" onClick={onZoomOut} className="rounded border px-2 py-1">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Zoom in" onClick={onZoomIn} className="rounded border px-2 py-1">+</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/ReaderToolbar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add reader toolbar (page nav, zoom, back)"
```

---

### Task 5: ReaderPage + routing + open-from-library

**Files:**
- Create: `src/frontend/pages/ReaderPage.tsx`
- Modify: `src/frontend/App.tsx` (add the route), `src/frontend/components/BookCard.tsx` (make it openable), `src/frontend/pages/LibraryPage.tsx` (navigate on open)
- Test: `src/frontend/pages/ReaderPage.test.tsx`, `src/frontend/pages/LibraryPage.test.tsx` (adjust for router)

**Interfaces:**
- Consumes: `getBook`, `getBookFileUrl` (`@backend/data/books`), `PdfViewer`, `ReaderToolbar`, `react-router-dom` (`useParams`, `useNavigate`).
- Produces: `ReaderPage` mounted at `/read/:bookId`. It loads the book + a signed file URL, holds `page`/`numPages`/`scale` state, wires the toolbar to page/zoom, and renders `PdfViewer` for PDFs (or a "not supported yet" note for EPUB). BookCard gains an `onOpen` and a clickable title; LibraryPage passes `onOpen={(id) => navigate('/read/' + id)}`.

- [ ] **Step 1: Write the failing ReaderPage test**

Create `src/frontend/pages/ReaderPage.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'

const { getBook, getBookFileUrl } = vi.hoisted(() => ({
  getBook: vi.fn(), getBookFileUrl: vi.fn(),
}))
vi.mock('@backend/data/books', () => ({ getBook, getBookFileUrl }))
vi.mock('@backend/data/progress', () => ({
  getProgress: vi.fn().mockResolvedValue(null),
  saveProgress: vi.fn().mockResolvedValue(undefined),
}))
// Mock the PDF viewer so we don't need a real canvas; report 5 pages.
vi.mock('@frontend/reader/PdfViewer', () => ({
  PdfViewer: ({ pageNumber, onNumPages }: { pageNumber: number; onNumPages: (n: number) => void }) => {
    onNumPages(5)
    return <div data-testid="pdf-page">page {pageNumber}</div>
  },
}))

import { ReaderPage } from './ReaderPage'

function renderAt(bookId: string) {
  return render(
    <MemoryRouter initialEntries={[`/read/${bookId}`]}>
      <Routes>
        <Route path="/read/:bookId" element={<ReaderPage />} />
        <Route path="/" element={<div>library</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getBook.mockResolvedValue({ id: 'b1', title: 'Dune', format: 'pdf', storage_path: 'u1/b1.pdf' })
  getBookFileUrl.mockResolvedValue('https://signed/b1.pdf')
})

test('loads the book and renders the first page', async () => {
  renderAt('b1')
  expect(await screen.findByTestId('pdf-page')).toHaveTextContent('page 1')
})

test('next page advances the rendered page', async () => {
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /next page/i }))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 2')
})

test('shows a placeholder for EPUB (not supported this milestone)', async () => {
  getBook.mockResolvedValue({ id: 'b2', title: 'Novel', format: 'epub', storage_path: 'u1/b2.epub' })
  renderAt('b2')
  expect(await screen.findByText(/not.*supported/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: FAIL — `./ReaderPage` not found.

- [ ] **Step 3: Implement ReaderPage**

Create `src/frontend/pages/ReaderPage.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Book } from '@shared/types'
import { getBook, getBookFileUrl } from '@backend/data/books'
import { PdfViewer } from '@frontend/reader/PdfViewer'
import { ReaderToolbar } from '@frontend/reader/ReaderToolbar'

const MIN_SCALE = 0.5
const MAX_SCALE = 3

export function ReaderPage() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (!bookId) return
    let active = true
    ;(async () => {
      try {
        const b = await getBook(bookId)
        if (!active) return
        setBook(b)
        if (b.format === 'pdf') setFileUrl(await getBookFileUrl(b.storage_path))
      } catch (e) {
        if (active) setError((e as Error).message)
      }
    })()
    return () => { active = false }
  }, [bookId])

  const goBack = useCallback(() => navigate('/'), [navigate])
  const prev = () => setPage((p) => Math.max(1, p - 1))
  const next = () => setPage((p) => (numPages ? Math.min(numPages, p + 1) : p + 1))
  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.25) * 100) / 100))
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.25) * 100) / 100))

  if (error) return <div className="p-6 text-red-600" role="alert">{error}</div>
  if (!book) return <div className="p-6">Loading…</div>

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col">
      <ReaderToolbar
        page={page} numPages={numPages} scale={scale}
        onPrev={prev} onNext={next} onZoomIn={zoomIn} onZoomOut={zoomOut} onBack={goBack}
      />
      <div className="flex flex-1 justify-center overflow-auto bg-gray-100 p-4">
        {book.format === 'pdf' && fileUrl ? (
          <PdfViewer fileUrl={fileUrl} pageNumber={page} scale={scale} onNumPages={setNumPages} />
        ) : book.format === 'pdf' ? (
          <div className="p-8 text-gray-500">Loading PDF…</div>
        ) : (
          <div className="p-8 text-gray-500">
            This format isn’t supported yet — EPUB reading arrives in a later update.
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Make BookCard openable**

In `src/frontend/components/BookCard.tsx`, add an `onOpen` prop and make the title + cover open the book. Change the component signature and the cover/title markup:
```tsx
import type { Book } from '@shared/types'

export function BookCard({
  book, onOpen, onRename, onDelete,
}: {
  book: Book
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col rounded border p-3">
      <button
        type="button"
        onClick={() => onOpen(book.id)}
        className="mb-2 flex aspect-[3/4] items-center justify-center rounded bg-gray-100 text-gray-400 hover:bg-gray-200"
      >
        {book.format.toUpperCase()}
      </button>
      <button type="button" onClick={() => onOpen(book.id)} className="text-left font-medium hover:underline">
        {book.title}
      </button>
      {book.author && <div className="text-sm text-gray-500">{book.author}</div>}
      <div className="mt-2 flex gap-3 text-sm">
        <button
          className="text-blue-600"
          onClick={() => {
            const title = window.prompt('New title', book.title)
            if (title && title !== book.title) onRename(book.id, title)
          }}
        >
          Rename
        </button>
        <button
          className="text-red-600"
          onClick={() => {
            if (window.confirm(`Delete "${book.title}"?`)) onDelete(book.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Wire navigation in LibraryPage and update its test for the router**

In `src/frontend/pages/LibraryPage.tsx`: import `useNavigate` from `react-router-dom`, create `const navigate = useNavigate()`, and pass `onOpen={(id) => navigate('/read/' + id)}` to each `<BookCard>`.

Because `LibraryPage` now calls `useNavigate`, its test must render inside a router. In `src/frontend/pages/LibraryPage.test.tsx`, wrap the rendered `<LibraryPage />` in `<MemoryRouter>` (add `import { MemoryRouter } from 'react-router-dom'`), e.g. replace each `render(<LibraryPage />)` with:
```tsx
render(<MemoryRouter><LibraryPage /></MemoryRouter>)
```
Add one navigation assertion test:
```tsx
import { MemoryRouter, Routes, Route } from 'react-router-dom'

test('clicking a book navigates to its reader route', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/read/:bookId" element={<div>reader for book</div>} />
      </Routes>
    </MemoryRouter>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Dune' }))
  expect(await screen.findByText('reader for book')).toBeInTheDocument()
})
```
(The existing library tests keep asserting book rendering / upload; they just gain the `MemoryRouter` wrapper.)

- [ ] **Step 7: Add the route in App.tsx**

In `src/frontend/App.tsx`, import `ReaderPage` and add the route inside the existing `<Routes>`:
```tsx
<Route path="/read/:bookId" element={<ReaderPage />} />
```

- [ ] **Step 8: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green (ReaderPage, BookCard-through-Library, navigation, and existing suites).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add reader page, route, and open-from-library navigation"
```

---

### Task 6: Resume + save reading position

**Files:**
- Modify: `src/frontend/pages/ReaderPage.tsx`
- Test: `src/frontend/pages/ReaderPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `getProgress`, `saveProgress` (`@backend/data/progress`).
- Produces: on open, ReaderPage resumes to the saved page (clamped to `[1, numPages]` once known); when the page changes it saves the new location (debounced ~500ms), skipping the initial render.

- [ ] **Step 1: Extend the test — resume + save**

Add to `src/frontend/pages/ReaderPage.test.tsx`. Update the `@backend/data/progress` mock to hoisted fns so they can be asserted, and use fake timers for the debounce:
```tsx
// replace the earlier progress mock with a hoisted one at the top of the file:
const { getProgress, saveProgress } = vi.hoisted(() => ({
  getProgress: vi.fn(), saveProgress: vi.fn(),
}))
vi.mock('@backend/data/progress', () => ({ getProgress, saveProgress }))
```
Then, in `beforeEach`, add:
```tsx
getProgress.mockResolvedValue(null)
saveProgress.mockResolvedValue(undefined)
```
Add these tests:
```tsx
test('resumes to the saved page', async () => {
  getProgress.mockResolvedValue('3')
  renderAt('b1')
  expect(await screen.findByTestId('pdf-page')).toHaveTextContent('page 3')
})

test('saves the location when the page changes (debounced)', async () => {
  vi.useFakeTimers()
  try {
    renderAt('b1')
    // let the async loads resolve
    await vi.runOnlyPendingTimersAsync()
    const next = screen.getByRole('button', { name: /next page/i })
    next.click()
    await vi.advanceTimersByTimeAsync(600)
    expect(saveProgress).toHaveBeenCalledWith('b1', '2')
  } finally {
    vi.useRealTimers()
  }
})
```
(If driving fake timers proves awkward with user-event, use the element's native `.click()` as shown rather than `userEvent`, which schedules its own timers.)

- [ ] **Step 2: Run — verify the new tests fail**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: FAIL — no resume/save behavior yet.

- [ ] **Step 3: Implement resume + debounced save**

In `src/frontend/pages/ReaderPage.tsx`:

Add imports:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { getProgress, saveProgress } from '@backend/data/progress'
```

In the load effect, after setting the book/file, also load progress and seed the page:
```tsx
const b = await getBook(bookId)
if (!active) return
setBook(b)
if (b.format === 'pdf') setFileUrl(await getBookFileUrl(b.storage_path))
const saved = await getProgress(bookId)
if (active && saved) setPage(Math.max(1, parseInt(saved, 10) || 1))
```

Add a save effect that debounces on `page`, skipping the first run:
```tsx
const didMount = useRef(false)
useEffect(() => {
  if (!bookId) return
  if (!didMount.current) { didMount.current = true; return }
  const t = setTimeout(() => { void saveProgress(bookId, String(page)) }, 500)
  return () => clearTimeout(t)
}, [bookId, page])
```

Clamp `page` to `numPages` once known (so a stale saved page beyond the doc is corrected):
```tsx
useEffect(() => {
  if (numPages && page > numPages) setPage(numPages)
}, [numPages, page])
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: PASS (all ReaderPage tests, incl. resume + save).

- [ ] **Step 5: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: resume and debounce-save reading position in the pdf reader"
```

---

## Self-Review

**Spec coverage (roadmap M2):**
- Open a PDF from the library → Task 5 (route + BookCard open + ReaderPage). ✓
- Exact-page rendering (PDF.js) → Task 3 (PdfViewer via react-pdf). ✓
- Page navigation → Task 4 (toolbar) + Task 5 (page state, bounds). ✓
- Zoom → Task 4 (controls) + Task 5 (scale state, clamped). ✓
- Progress + resume → Task 6 (resume on open, debounced save). ✓
- Repository boundary: file URL + progress via `@backend/data/*`; UI never imports `@backend/supabase`. ✓
- EPUB explicitly deferred with a placeholder → Task 5. ✓

**Placeholder scan:** every code step has complete code; no TBDs. The only intentional stub is the EPUB "not supported yet" message (M3 replaces it).

**Type consistency:** `getBook(id): Promise<Book>`, `getBookFileUrl(path): Promise<string>`, `getProgress(id): Promise<string|null>`, `saveProgress(id, location)`; `PdfViewer` props `{fileUrl, pageNumber, scale, onNumPages}`; `ReaderToolbar` props match Task 4 and their use in Task 5. PDF location is a stringified page number throughout, matching `reading_progress.location`.

**Note on tests:** react-pdf and pdf.js can't render in jsdom, so `PdfViewer` is mocked in `ReaderPage` tests and react-pdf is mocked in `PdfViewer`'s own test — real PDF rendering is verified in the Milestone 2 manual check (open a real PDF, pages render, nav/zoom work, reload resumes).
