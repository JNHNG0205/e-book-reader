# Milestone 4a: Bookmarks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bookmark the current location in a PDF or EPUB, see all bookmarks in a side panel, jump to one, and delete one — unified across both formats.

**Architecture:** A format-agnostic `bookmarks` repository (`@backend/data/bookmarks`), reusing the existing `bookmarks` table (location = PDF page number or EPUB CFI). A reusable **tabbed reader sidebar** (`ReaderSidebar`) that hosts Contents (EPUB) and Bookmarks tabs today and a Highlights tab in M4b. Each reader (PDF `ReaderPage`, EPUB `EpubReader`) supplies its current location + a jump function.

**Tech Stack:** existing React 19 / Vite / TS / Tailwind / Supabase / Vitest.

## Global Constraints

- **Repository pattern:** reader UI reads/writes bookmarks only via `@backend/data/bookmarks`, never `@backend/supabase`.
- **Bookmark location is a string** in the `bookmarks.location` text column: PDF = page number (`String(page)`); EPUB = CFI.
- Folder split + alias imports; test `vi.mock()` paths match import paths.
- TypeScript strict, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` must stay green.
- **Preserve the current EPUB TOC behavior** when moving it into the sidebar: active-section highlight, stays open on navigate, closes only via the sidebar's ✕.
- Don't disturb existing reader features (PDF page/zoom/resume, EPUB font/theme/progress/resume).

---

### Task 1: Bookmarks repository

**Files:**
- Create: `src/backend/data/bookmarks.ts`
- Test: `src/backend/data/bookmarks.test.ts`

**Interfaces:**
- Consumes: `supabase` (`@backend/supabase`), `requireUserId` (`./currentUser`), `Bookmark` (`@shared/types`).
- Produces:
  - `listBookmarks(bookId: string): Promise<Bookmark[]>` — the user's bookmarks for the book, oldest first.
  - `saveBookmark(bookId: string, fields: { location: string; label?: string }): Promise<Bookmark>`
  - `deleteBookmark(id: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/backend/data/bookmarks.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { from } }))
vi.mock('./currentUser', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { listBookmarks, saveBookmark, deleteBookmark } from './bookmarks'

beforeEach(() => vi.clearAllMocks())

test('listBookmarks returns the user rows ordered by created_at asc', async () => {
  const rows = [{ id: 'bm1' }, { id: 'bm2' }]
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ order }) }) })
  expect(await listBookmarks('b1')).toEqual(rows)
  expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
})

test('saveBookmark inserts location + label for the user+book', async () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'bm1' }, error: null })
  const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
  from.mockReturnValue({ insert })
  const bm = await saveBookmark('b1', { location: '7', label: 'Page 7' })
  expect(bm).toEqual({ id: 'bm1' })
  expect(insert).toHaveBeenCalledWith({ user_id: 'u1', book_id: 'b1', location: '7', label: 'Page 7' })
})

test('deleteBookmark deletes by id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ delete: () => ({ eq }) })
  await deleteBookmark('bm1')
  expect(eq).toHaveBeenCalledWith('id', 'bm1')
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/backend/data/bookmarks.test.ts`
Expected: FAIL — `./bookmarks` not found.

- [ ] **Step 3: Implement**

Create `src/backend/data/bookmarks.ts`:
```ts
import { supabase } from '@backend/supabase'
import { requireUserId } from './currentUser'
import type { Bookmark } from '@shared/types'

export async function listBookmarks(bookId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Bookmark[]
}

export async function saveBookmark(
  bookId: string,
  fields: { location: string; label?: string },
): Promise<Bookmark> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('bookmarks')
    .insert({ user_id: userId, book_id: bookId, location: fields.location, label: fields.label ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Bookmark
}

export async function deleteBookmark(id: string): Promise<void> {
  const { error } = await supabase.from('bookmarks').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/backend/data/bookmarks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add bookmarks repository (list/save/delete)"
```

---

### Task 2: ReaderSidebar (tabbed) + BookmarksPanel, TocPanel to tab-content

**Files:**
- Create: `src/frontend/reader/ReaderSidebar.tsx`, `src/frontend/reader/BookmarksPanel.tsx`
- Modify: `src/frontend/reader/TocPanel.tsx` (drop its own frame/header/close so it renders as a tab body)
- Test: `src/frontend/reader/ReaderSidebar.test.tsx`, `src/frontend/reader/BookmarksPanel.test.tsx`, `src/frontend/reader/TocPanel.test.tsx` (update)

**Interfaces:**
- Produces:
  - `ReaderSidebar` — props `{ tabs: SidebarTab[]; onClose: () => void }`, where `SidebarTab = { key: string; label: string; render: () => ReactNode }`. Renders a fixed-width panel with a tab bar + a ✕ close, showing the active tab's body. Manages the active tab internally (defaults to the first).
  - `BookmarksPanel` — props `{ bookmarks: Bookmark[]; onJump: (location: string) => void; onDelete: (id: string) => void }`.
  - `TocPanel` — now just the list body: props unchanged (`{ items: TocItem[]; onNavigate: (href: string) => void; activeHref?: string | null }`) but WITHOUT the outer width/header/close (the sidebar provides those).

- [ ] **Step 1: Write failing tests for ReaderSidebar**

Create `src/frontend/reader/ReaderSidebar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { ReaderSidebar } from './ReaderSidebar'

const tabs = [
  { key: 'contents', label: 'Contents', render: () => <div>toc body</div> },
  { key: 'bookmarks', label: 'Bookmarks', render: () => <div>bm body</div> },
]

test('shows the first tab by default', () => {
  render(<ReaderSidebar tabs={tabs} onClose={() => {}} />)
  expect(screen.getByText('toc body')).toBeInTheDocument()
  expect(screen.queryByText('bm body')).not.toBeInTheDocument()
})

test('switches tabs on click', async () => {
  render(<ReaderSidebar tabs={tabs} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Bookmarks' }))
  expect(screen.getByText('bm body')).toBeInTheDocument()
})

test('close button fires onClose', async () => {
  const onClose = vi.fn()
  render(<ReaderSidebar tabs={tabs} onClose={onClose} />)
  await userEvent.click(screen.getByRole('button', { name: /close panel/i }))
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/ReaderSidebar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ReaderSidebar**

Create `src/frontend/reader/ReaderSidebar.tsx`:
```tsx
import { useState, type ReactNode } from 'react'

export interface SidebarTab {
  key: string
  label: string
  render: () => ReactNode
}

export function ReaderSidebar({ tabs, onClose }: { tabs: SidebarTab[]; onClose: () => void }) {
  const [active, setActive] = useState(tabs[0]?.key)
  const current = tabs.find((t) => t.key === active) ?? tabs[0]

  return (
    <div className="flex w-72 shrink-0 flex-col border-r bg-white">
      <div className="flex items-center justify-between border-b">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`px-3 py-2 text-sm ${
                t.key === current?.key ? 'border-b-2 border-black font-medium' : 'text-gray-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Close panel" onClick={onClose} className="px-3 text-gray-500">
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{current?.render()}</div>
    </div>
  )
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/ReaderSidebar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write failing tests for BookmarksPanel**

Create `src/frontend/reader/BookmarksPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { BookmarksPanel } from './BookmarksPanel'

const bookmarks = [
  { id: 'bm1', user_id: 'u1', book_id: 'b1', location: '7', label: 'Page 7', created_at: '', updated_at: '' },
]

test('lists bookmarks and jumps on click', async () => {
  const onJump = vi.fn()
  render(<BookmarksPanel bookmarks={bookmarks} onJump={onJump} onDelete={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Page 7' }))
  expect(onJump).toHaveBeenCalledWith('7')
})

test('deletes on the delete control', async () => {
  const onDelete = vi.fn()
  render(<BookmarksPanel bookmarks={bookmarks} onJump={() => {}} onDelete={onDelete} />)
  await userEvent.click(screen.getByRole('button', { name: /delete bookmark/i }))
  expect(onDelete).toHaveBeenCalledWith('bm1')
})

test('shows an empty note when there are none', () => {
  render(<BookmarksPanel bookmarks={[]} onJump={() => {}} onDelete={() => {}} />)
  expect(screen.getByText(/no bookmarks/i)).toBeInTheDocument()
})
```

- [ ] **Step 6: Run — verify it fails**

Run: `bun run test src/frontend/reader/BookmarksPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement BookmarksPanel**

Create `src/frontend/reader/BookmarksPanel.tsx`:
```tsx
import type { Bookmark } from '@shared/types'

export function BookmarksPanel({
  bookmarks, onJump, onDelete,
}: {
  bookmarks: Bookmark[]
  onJump: (location: string) => void
  onDelete: (id: string) => void
}) {
  if (bookmarks.length === 0) {
    return <p className="p-3 text-sm text-gray-400">No bookmarks yet.</p>
  }
  return (
    <ul className="p-2 text-sm">
      {bookmarks.map((b) => (
        <li key={b.id} className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-100">
          <button type="button" onClick={() => onJump(b.location)} className="flex-1 truncate text-left">
            {b.label ?? 'Bookmark'}
          </button>
          <button
            type="button"
            aria-label="Delete bookmark"
            onClick={() => onDelete(b.id)}
            className="text-red-600 opacity-0 group-hover:opacity-100"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 8: Run — verify it passes**

Run: `bun run test src/frontend/reader/BookmarksPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Refactor TocPanel into tab-content (list only)**

Replace `src/frontend/reader/TocPanel.tsx` so it renders just the list body (no outer nav width/header/close — the sidebar owns those):
```tsx
import type { TocItem } from './epubToc'

export function TocPanel({
  items, onNavigate, activeHref,
}: {
  items: TocItem[]
  onNavigate: (href: string) => void
  activeHref?: string | null
}) {
  if (items.length === 0) {
    return <p className="p-3 text-sm text-gray-400">No contents available.</p>
  }
  return (
    <ul className="p-2 text-sm">
      {items.map((item, i) => {
        const active = item.href === activeHref
        return (
          <li key={`${item.href}-${i}`}>
            <button
              type="button"
              onClick={() => onNavigate(item.href)}
              className={`block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100 ${
                active ? 'bg-blue-100 font-medium text-blue-700' : ''
              }`}
              style={{ paddingLeft: `${0.5 + item.level * 0.75}rem` }}
            >
              {item.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

Update `src/frontend/reader/TocPanel.test.tsx`: remove any assertion about a "Contents" header or a close button (those moved to the sidebar). Keep: lists entries, navigates on click with href, highlights the active item, shows the empty note. Concretely, the "empty" assertion text is now `/no contents/i` (unchanged), and drop any `onClose`/"Close contents" test. If a test rendered `<TocPanel onClose=... />`, remove that prop and its assertion.

- [ ] **Step 10: Run — verify TocPanel tests pass**

Run: `bun run test src/frontend/reader/TocPanel.test.tsx`
Expected: PASS.

- [ ] **Step 11: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green. (EpubReader still imports TocPanel; its usage is updated in Task 3 — but the props it passes, `items`/`onNavigate`/`activeHref`, are unchanged, so it still compiles.)

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add tabbed ReaderSidebar and BookmarksPanel; TocPanel as tab body"
```

---

### Task 3: EPUB reader bookmarks (sidebar + add button)

**Files:**
- Modify: `src/frontend/reader/EpubReader.tsx`, `src/frontend/reader/EpubToolbar.tsx`
- Test: `src/frontend/reader/EpubReader.test.tsx` (extend), `src/frontend/reader/EpubToolbar.test.tsx` (extend)

**Interfaces:**
- Consumes: `listBookmarks`, `saveBookmark`, `deleteBookmark` (`@backend/data/bookmarks`), `ReaderSidebar`, `BookmarksPanel`, `TocPanel`.
- Produces: EPUB reader renders the tabbed sidebar (Contents + Bookmarks). A toolbar bookmark button adds a bookmark at the current CFI (label derived from progress if available). Bookmarks list loads on open; jump uses `viewerRef.goTo(location)`; delete removes it.

- [ ] **Step 1: Add a bookmark-add button to EpubToolbar (test first)**

In `src/frontend/reader/EpubToolbar.test.tsx`, add to the base props `onAddBookmark: vi.fn()` and a test:
```tsx
test('fires add-bookmark', async () => {
  const onAddBookmark = vi.fn()
  render(<EpubToolbar {...props} onAddBookmark={onAddBookmark} />)
  await userEvent.click(screen.getByRole('button', { name: /bookmark/i }))
  expect(onAddBookmark).toHaveBeenCalled()
})
```
Run: `bun run test src/frontend/reader/EpubToolbar.test.tsx` → FAIL (no such button).

- [ ] **Step 2: Implement the toolbar button**

In `src/frontend/reader/EpubToolbar.tsx`, add `onAddBookmark: () => void` to `EpubToolbarProps`, and a button next to the ☰ toggle:
```tsx
<button type="button" aria-label="Add bookmark" onClick={onAddBookmark} className="rounded border px-2 py-1">🔖</button>
```
(Place it in the left group next to the contents toggle. Keep the ☰ contents toggle — it now opens the sidebar.)
Run: `bun run test src/frontend/reader/EpubToolbar.test.tsx` → PASS.

- [ ] **Step 3: Extend EpubReader tests for bookmarks**

In `src/frontend/reader/EpubReader.test.tsx`, add a hoisted mock for `@backend/data/bookmarks`:
```tsx
const { listBookmarks, saveBookmark, deleteBookmark } = vi.hoisted(() => ({
  listBookmarks: vi.fn(), saveBookmark: vi.fn(), deleteBookmark: vi.fn(),
}))
vi.mock('@backend/data/bookmarks', () => ({ listBookmarks, saveBookmark, deleteBookmark }))
```
In `beforeEach`: `listBookmarks.mockResolvedValue([]); saveBookmark.mockResolvedValue({ id: 'bm1' }); deleteBookmark.mockResolvedValue(undefined)`.
Add tests:
```tsx
test('adds a bookmark at the current cfi', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  // simulate a relocation so there is a current cfi
  act(() => { (viewerProps.current?.onRelocated as (c: string) => void)('epubcfi(/6/14!/2)') })
  await userEvent.click(screen.getByRole('button', { name: /add bookmark/i }))
  await waitFor(() => expect(saveBookmark).toHaveBeenCalledWith('b1', expect.objectContaining({ location: 'epubcfi(/6/14!/2)' })))
})

test('shows bookmarks in the sidebar and jumps via goTo', async () => {
  listBookmarks.mockResolvedValue([
    { id: 'bm1', user_id: 'u1', book_id: 'b1', location: 'epubcfi(/6/20!/4)', label: 'Loc 42', created_at: '', updated_at: '' },
  ])
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Bookmarks' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Loc 42' }))
  expect(goTo).toHaveBeenCalledWith('epubcfi(/6/20!/4)')
})
```
(These rely on the existing EpubViewer mock exposing `onRelocated`/`goTo` — already present in that test file.)
Run: `bun run test src/frontend/reader/EpubReader.test.tsx` → FAIL.

- [ ] **Step 4: Implement bookmarks in EpubReader**

In `src/frontend/reader/EpubReader.tsx`:
- Import: `import { listBookmarks, saveBookmark, deleteBookmark } from '@backend/data/bookmarks'`, `ReaderSidebar` (`./ReaderSidebar`), `BookmarksPanel` (`./BookmarksPanel`), `type Bookmark` (`@shared/types`).
- State: `const [currentCfi, setCurrentCfi] = useState<string | null>(null)`, `const [bookmarks, setBookmarks] = useState<Bookmark[]>([])`. (`tocOpen` already exists — reuse it as the sidebar open flag; rename its concept to "sidebar".)
- In `onRelocated(cfi)`, also `setCurrentCfi(cfi)` (in addition to the existing debounced progress save).
- Load bookmarks on mount: `useEffect(() => { listBookmarks(bookId).then(setBookmarks).catch(() => {}) }, [bookId])`.
- Handlers:
  ```tsx
  async function addBookmark() {
    if (!currentCfi) return
    const label = progress ? `Location ${progress.current}` : 'Bookmark'
    const bm = await saveBookmark(bookId, { location: currentCfi, label })
    setBookmarks((prev) => [...prev, bm])
  }
  async function removeBookmark(id: string) {
    await deleteBookmark(id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }
  ```
- Replace the standalone `{tocOpen && <TocPanel .../>}` block with the sidebar:
  ```tsx
  {tocOpen && (
    <ReaderSidebar
      onClose={() => setTocOpen(false)}
      tabs={[
        { key: 'contents', label: 'Contents', render: () => (
          <TocPanel items={toc} activeHref={activeHref}
            onNavigate={(href) => { viewerRef.current?.goTo(href); setActiveHref(href) }} />
        ) },
        { key: 'bookmarks', label: 'Bookmarks', render: () => (
          <BookmarksPanel bookmarks={bookmarks}
            onJump={(loc) => viewerRef.current?.goTo(loc)}
            onDelete={removeBookmark} />
        ) },
      ]}
    />
  )}
  ```
- Pass `onAddBookmark={() => { void addBookmark() }}` to `<EpubToolbar>`.

- [ ] **Step 5: Run — verify EpubReader + toolbar tests pass**

Run: `bun run test src/frontend/reader/EpubReader.test.tsx src/frontend/reader/EpubToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: EPUB bookmarks with tabbed sidebar (contents + bookmarks)"
```

---

### Task 4: PDF reader bookmarks (sidebar + add button)

**Files:**
- Modify: `src/frontend/pages/ReaderPage.tsx`, `src/frontend/reader/ReaderToolbar.tsx`
- Test: `src/frontend/pages/ReaderPage.test.tsx` (extend), `src/frontend/reader/ReaderToolbar.test.tsx` (extend)

**Interfaces:**
- Consumes: `listBookmarks`, `saveBookmark`, `deleteBookmark`, `ReaderSidebar`, `BookmarksPanel`.
- Produces: PDF reader gets a sidebar toggle + bookmark-add button in `ReaderToolbar`; the sidebar shows a Bookmarks tab; add uses `String(page)` with label `Page N`; jump sets the page; delete removes it.

- [ ] **Step 1: Add sidebar toggle + bookmark button to ReaderToolbar (test first)**

In `src/frontend/reader/ReaderToolbar.test.tsx`, add `onAddBookmark: vi.fn()` and `onToggleSidebar: vi.fn()` to base props; add tests that clicking the "Add bookmark" and "Bookmarks" (sidebar toggle) buttons fire them.
Run → FAIL.

- [ ] **Step 2: Implement the toolbar buttons**

In `src/frontend/reader/ReaderToolbar.tsx`, add `onAddBookmark: () => void` and `onToggleSidebar: () => void` to props. In the left group (near ← Library), add:
```tsx
<button type="button" aria-label="Bookmarks" onClick={onToggleSidebar} className="rounded border px-2 py-1">☰</button>
<button type="button" aria-label="Add bookmark" onClick={onAddBookmark} className="rounded border px-2 py-1">🔖</button>
```
Run → PASS.

- [ ] **Step 3: Extend ReaderPage tests for PDF bookmarks**

In `src/frontend/pages/ReaderPage.test.tsx`, add a hoisted mock of `@backend/data/bookmarks` (listBookmarks→[], saveBookmark→{id:'bm1'}, deleteBookmark). Add tests:
```tsx
test('adds a bookmark at the current page', async () => {
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /add bookmark/i }))
  await waitFor(() => expect(saveBookmark).toHaveBeenCalledWith('b1', expect.objectContaining({ location: '1', label: 'Page 1' })))
})

test('opens the sidebar and jumps to a bookmarked page', async () => {
  listBookmarks.mockResolvedValue([
    { id: 'bm1', user_id: 'u1', book_id: 'b1', location: '3', label: 'Page 3', created_at: '', updated_at: '' },
  ])
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /bookmarks/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Page 3' }))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 3')
})
```
Run → FAIL.

- [ ] **Step 4: Implement bookmarks in ReaderPage (PDF branch only)**

In `src/frontend/pages/ReaderPage.tsx`:
- Import `listBookmarks, saveBookmark, deleteBookmark` (`@backend/data/bookmarks`), `ReaderSidebar`, `BookmarksPanel`, `type Bookmark`.
- State: `const [sidebarOpen, setSidebarOpen] = useState(false)`, `const [bookmarks, setBookmarks] = useState<Bookmark[]>([])`.
- Load bookmarks for PDFs: in an effect keyed on `[bookId, book?.format]`, if `book?.format === 'pdf'` call `listBookmarks(bookId!).then(setBookmarks)`.
- Handlers:
  ```tsx
  async function addBookmark() {
    const bm = await saveBookmark(book!.id, { location: String(page), label: `Page ${page}` })
    setBookmarks((prev) => [...prev, bm])
  }
  async function removeBookmark(id: string) {
    await deleteBookmark(id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }
  function jumpToBookmark(location: string) {
    const p = parseInt(location, 10)
    if (p) setPage(p)
  }
  ```
- Pass `onAddBookmark={() => { void addBookmark() }}` and `onToggleSidebar={() => setSidebarOpen((v) => !v)}` to `<ReaderToolbar>` (PDF branch only).
- In the PDF content area, render the sidebar alongside the viewer:
  ```tsx
  <div className="flex flex-1 justify-center overflow-auto bg-gray-100">
    {sidebarOpen && (
      <ReaderSidebar
        onClose={() => setSidebarOpen(false)}
        tabs={[{ key: 'bookmarks', label: 'Bookmarks', render: () => (
          <BookmarksPanel bookmarks={bookmarks} onJump={jumpToBookmark} onDelete={removeBookmark} />
        ) }]}
      />
    )}
    <div className="p-4">
      <PdfViewer fileUrl={fileUrl} pageNumber={page} scale={scale} onNumPages={setNumPages} />
    </div>
  </div>
  ```
  (Adapt to the existing PDF-branch JSX; keep the EPUB branch and the `book.format === 'pdf'` toolbar gating unchanged. Only the PDF layout gains the sidebar.)

- [ ] **Step 5: Run — verify ReaderPage + toolbar tests pass**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx src/frontend/reader/ReaderToolbar.test.tsx`
Expected: PASS.

- [ ] **Step 6: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: PDF bookmarks with tabbed sidebar"
```

---

## Self-Review

**Spec coverage (M4a bookmarks slice of roadmap M4):**
- Bookmark current location, both formats → Tasks 3 (EPUB, CFI) + 4 (PDF, page). ✓
- List bookmarks + jump + delete → Task 2 (BookmarksPanel) wired in Tasks 3/4. ✓
- Unified tabbed sidebar (Contents/Bookmarks; Highlights added in M4b) → Task 2 (ReaderSidebar) + Tasks 3/4. ✓
- Repository boundary: bookmarks via `@backend/data/bookmarks`. ✓
- Highlights (pen, notes, panel) → **M4b, separate plan** (not this milestone).

**Placeholder scan:** every code step has complete code; the only intentional deferral is the Highlights tab (M4b).

**Type consistency:** `Bookmark` from `@shared/types` throughout; `saveBookmark(bookId, { location, label })`, `listBookmarks(bookId)`, `deleteBookmark(id)` match across repo + both readers; location is a string (PDF page number / EPUB CFI); `SidebarTab { key, label, render }` used by both readers.

**Test isolation:** bookmarks repo mocked in reader tests; the EPUB `goTo`/`onRelocated` and PDF `PdfViewer` mocks already exist in those test files. Real cross-device bookmark round-trips are covered by the end-of-milestone manual check (add a bookmark, reload, it persists and jumps).
