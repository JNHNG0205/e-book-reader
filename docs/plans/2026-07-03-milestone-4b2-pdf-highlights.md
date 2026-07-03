# Milestone 4b-2: PDF Highlights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The same highlight UX as EPUB, for PDFs: select text on a page → color popover → highlight; click a highlight to recolor / add a note / remove; a Highlights tab in the PDF sidebar (filter by color, jump to page). Persisted per user.

**Architecture:** Reuse the shared pieces from M4b-1 — the `highlights` repository (`@backend/data/highlights`), `HighlightPopover`, `HighlightsPanel`, and `highlightColors`. The PDF-specific work: enable react-pdf's **text layer** (currently off), convert a text selection to **page-normalized rectangles** (0–1, so they survive zoom), store `anchor = { page, rects, text }` in the `highlights.anchor` jsonb, and render saved highlights as absolutely-positioned overlay `<div>`s over the page. Unlike EPUB (iframe + epub.js annotations), the PDF page + overlays live in the host document, so selection/click coordinates are already viewport coordinates.

**Tech Stack:** existing React 19 / Vite / TS / Tailwind / Supabase / Vitest + react-pdf (pdfjs).

## Global Constraints

- **Repository pattern:** the reader reads/writes highlights only via `@backend/data/highlights`, never `@backend/supabase`.
- **PDF highlight anchor** = `{ page: number, rects: NormRect[], text: string }` where `NormRect = { x, y, w, h }` are fractions (0–1) of the page's width/height. `color` is a palette key.
- Overlays are positioned with **percentages** of the page wrapper, so they scale automatically with zoom — no pixel recompute needed.
- react-pdf / pdfjs still can't render a real page in jsdom, so the text layer + selection geometry are unit-tested with mocks and verified in the manual browser check.
- Folder split + alias imports; test `vi.mock()` paths match import paths.
- TypeScript strict, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` green.
- Do NOT disturb the EPUB reader or existing PDF features (page nav, zoom, resume, bookmarks). The Highlights tab is added alongside the existing Bookmarks tab in the PDF `ReaderSidebar`.

---

### Task 1: PDF highlight geometry util

**Files:**
- Create: `src/frontend/reader/pdfHighlightGeometry.ts`
- Test: `src/frontend/reader/pdfHighlightGeometry.test.ts`

**Interfaces:**
- Produces:
  - `NormRect = { x: number; y: number; w: number; h: number }`
  - `clientRectsToNormalized(clientRects: Rectish[], pageRect: Rectish): NormRect[]` — converts viewport client rects to page-relative fractions; returns `[]` if the page has zero size. (`Rectish = { left: number; top: number; width: number; height: number }`.)

- [ ] **Step 1: Write the failing test**

Create `src/frontend/reader/pdfHighlightGeometry.test.ts`:
```ts
import { expect, test } from 'vitest'
import { clientRectsToNormalized } from './pdfHighlightGeometry'

const page = { left: 100, top: 200, width: 400, height: 800 }

test('normalizes a client rect relative to the page', () => {
  const rects = clientRectsToNormalized(
    [{ left: 100, top: 200, width: 200, height: 40 }],
    page,
  )
  expect(rects).toEqual([{ x: 0, y: 0, w: 0.5, h: 0.05 }])
})

test('normalizes an offset rect', () => {
  const rects = clientRectsToNormalized(
    [{ left: 300, top: 600, width: 100, height: 80 }],
    page,
  )
  expect(rects).toEqual([{ x: 0.5, y: 0.5, w: 0.25, h: 0.1 }])
})

test('returns empty for a zero-size page', () => {
  expect(clientRectsToNormalized([{ left: 0, top: 0, width: 10, height: 10 }],
    { left: 0, top: 0, width: 0, height: 0 })).toEqual([])
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/pdfHighlightGeometry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/frontend/reader/pdfHighlightGeometry.ts`:
```ts
export interface NormRect {
  x: number
  y: number
  w: number
  h: number
}

interface Rectish {
  left: number
  top: number
  width: number
  height: number
}

// Converts viewport client rects (e.g. from a text-selection Range) to fractions of the
// page's own box, so a highlight survives zoom and re-render (overlays position by %).
export function clientRectsToNormalized(clientRects: Rectish[], pageRect: Rectish): NormRect[] {
  if (pageRect.width === 0 || pageRect.height === 0) return []
  return clientRects.map((r) => ({
    x: (r.left - pageRect.left) / pageRect.width,
    y: (r.top - pageRect.top) / pageRect.height,
    w: r.width / pageRect.width,
    h: r.height / pageRect.height,
  }))
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/pdfHighlightGeometry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add pdf highlight geometry (client rects to normalized page rects)"
```

---

### Task 2: PdfViewer text layer, selection, and highlight overlays

**Files:**
- Modify: `src/frontend/reader/PdfViewer.tsx`
- Test: `src/frontend/reader/PdfViewer.test.tsx` (extend)

**Interfaces:**
- Adds to `PdfViewerProps`:
  - `highlights?: Array<{ id: string; color: string; rects: NormRect[] }>` — saved highlights for the CURRENTLY shown page (the reader filters by page).
  - `onSelect?: (sel: { rects: NormRect[]; text: string; x: number; y: number }) => void`
  - `onHighlightClick?: (id: string, x: number, y: number) => void`
- Behavior:
  - Turn the text layer ON (`renderTextLayer` no longer false) and import react-pdf's TextLayer CSS so spans are positioned/selectable.
  - Wrap `<Page>` in a `position: relative; display: inline-block` container (ref'd) so overlays and the page share one coordinate box.
  - On `mouseup` in the wrapper: if there's a non-collapsed text selection, convert its `range.getClientRects()` to normalized rects (via `clientRectsToNormalized`, relative to the wrapper's `getBoundingClientRect()`), and call `onSelect` with the rects, the selection text, and a viewport (x, y) from the last client rect (for the popover). If the selection is empty, do nothing (the popover closes itself on outside-click, since everything is in the host document).
  - Render each highlight's rects as absolutely-positioned overlay `<div>`s using percentage left/top/width/height (`r.x*100%`, …), `backgroundColor: colorValue(color)`, translucent (`opacity: 0.35`, `mixBlendMode: multiply`), `cursor: pointer`, and `onClick` → `onHighlightClick(id, e.clientX, e.clientY)` (real viewport coords — no iframe).

- [ ] **Step 1: Extend the test — overlays + selection**

In `src/frontend/reader/PdfViewer.test.tsx`, add tests (the `react-pdf` mock already stubs Document/Page):
```tsx
test('renders highlight overlays as percentage-positioned boxes', () => {
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}}
      highlights={[{ id: 'h1', color: 'yellow', rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }] }]} />,
  )
  const overlay = container.querySelector('[data-highlight-id="h1"]') as HTMLElement
  expect(overlay).not.toBeNull()
  expect(overlay.style.left).toBe('10%')
  expect(overlay.style.width).toBe('30%')
})

test('reports a text selection on mouseup', async () => {
  const onSelect = vi.fn()
  // Stub the selection + the wrapper geometry.
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: false,
    toString: () => 'picked text',
    getRangeAt: () => ({
      getClientRects: () => [{ left: 100, top: 200, width: 200, height: 40 }],
    }),
  } as unknown as Selection)
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}} onSelect={onSelect} />,
  )
  const wrapper = container.querySelector('[data-pdf-page-wrapper]') as HTMLElement
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 200, width: 400, height: 800 } as DOMRect)
  wrapper.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    text: 'picked text',
    rects: [{ x: 0, y: 0, w: 0.5, h: 0.05 }],
  }))
  vi.restoreAllMocks()
})

test('clicking an overlay reports the highlight id', async () => {
  const onHighlightClick = vi.fn()
  const { container } = render(
    <PdfViewer fileUrl="https://x/y.pdf" pageNumber={1} scale={1} onNumPages={() => {}}
      highlights={[{ id: 'h1', color: 'yellow', rects: [{ x: 0, y: 0, w: 0.3, h: 0.05 }] }]}
      onHighlightClick={onHighlightClick} />,
  )
  const overlay = container.querySelector('[data-highlight-id="h1"]') as HTMLElement
  await userEvent.click(overlay)
  expect(onHighlightClick).toHaveBeenCalledWith('h1', expect.any(Number), expect.any(Number))
})
```
(Add `import userEvent from '@testing-library/user-event'` if not present.)

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/PdfViewer.test.tsx`
Expected: FAIL — no overlays/selection yet.

- [ ] **Step 3: Implement PdfViewer highlight support**

Rewrite `src/frontend/reader/PdfViewer.tsx`:
```tsx
import { useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import { colorValue } from './highlightColors'
import { clientRectsToNormalized, type NormRect } from './pdfHighlightGeometry'

// Configure the PDF.js worker (Vite resolves this URL at build time).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export interface PdfViewerHighlight {
  id: string
  color: string
  rects: NormRect[]
}

export interface PdfViewerProps {
  fileUrl: string
  pageNumber: number
  scale: number
  onNumPages: (n: number) => void
  highlights?: PdfViewerHighlight[]
  onSelect?: (sel: { rects: NormRect[]; text: string; x: number; y: number }) => void
  onHighlightClick?: (id: string, x: number, y: number) => void
}

export function PdfViewer({
  fileUrl, pageNumber, scale, onNumPages, highlights, onSelect, onHighlightClick,
}: PdfViewerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)

  function handleMouseUp() {
    if (!onSelect || !wrapperRef.current) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const text = sel.toString().trim()
    if (!text) return
    const clientRects = Array.from(sel.getRangeAt(0).getClientRects())
    if (clientRects.length === 0) return
    const pageRect = wrapperRef.current.getBoundingClientRect()
    const rects = clientRectsToNormalized(clientRects, pageRect)
    const last = clientRects[clientRects.length - 1]
    onSelect({ rects, text, x: last.left + last.width / 2, y: last.top })
  }

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => onNumPages(numPages)}
      loading={<div className="p-8 text-gray-500">Loading PDF…</div>}
      error={<div className="p-8 text-red-600">Failed to load PDF.</div>}
    >
      <div
        ref={wrapperRef}
        data-pdf-page-wrapper
        className="relative inline-block"
        onMouseUp={handleMouseUp}
      >
        <Page pageNumber={pageNumber} scale={scale} renderAnnotationLayer={false} />
        {highlights?.flatMap((h) =>
          h.rects.map((r, i) => (
            <div
              key={`${h.id}-${i}`}
              data-highlight-id={h.id}
              onClick={(e) => onHighlightClick?.(h.id, e.clientX, e.clientY)}
              style={{
                position: 'absolute',
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                backgroundColor: colorValue(h.color),
                opacity: 0.35,
                mixBlendMode: 'multiply',
                cursor: 'pointer',
              }}
            />
          )),
        )}
      </div>
    </Document>
  )
}
```
Note: confirm the TextLayer CSS import path for the installed react-pdf@10 (it may be `react-pdf/dist/Page/TextLayer.css` or `react-pdf/dist/esm/Page/TextLayer.css`). If the exact path differs, use the correct one and note it in the report. (Do NOT import the AnnotationLayer CSS — annotation layer stays off.)

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/PdfViewer.test.tsx`
Expected: PASS (existing render/onNumPages tests + the 3 new ones).

- [ ] **Step 5: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green (the TextLayer CSS import must resolve in the Vite build).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: PdfViewer text-layer selection + highlight overlays"
```

---

### Task 3: ReaderPage PDF highlight orchestration + Highlights tab

**Files:**
- Modify: `src/frontend/pages/ReaderPage.tsx`
- Test: `src/frontend/pages/ReaderPage.test.tsx` (extend)

**Interfaces:**
- Consumes: `listHighlights`, `saveHighlight`, `updateHighlight`, `deleteHighlight` (`@backend/data/highlights`), `HighlightPopover`, `HighlightsPanel`, the PdfViewer highlight props.
- Produces (PDF branch only): loads highlights; passes the CURRENT page's highlights (`{id,color,rects}`) to `PdfViewer`; on `onSelect` shows a create `HighlightPopover`; picking a color saves `anchor = { page, rects, text }`; on `onHighlightClick` shows an edit popover (recolor / note / delete); adds a **Highlights** tab to the PDF `ReaderSidebar` (jump = `setPage(anchor.page)`, delete).

- [ ] **Step 1: Extend ReaderPage tests**

In `src/frontend/pages/ReaderPage.test.tsx`, add a hoisted mock for `@backend/data/highlights` (listHighlights→[], saveHighlight→a row, updateHighlight, deleteHighlight). The `PdfViewer` mock captures its props — extend it to echo/drive `onSelect`, `onHighlightClick`, and to accept `highlights`. Add tests:
```tsx
test('creates a PDF highlight from a selection on the current page', async () => {
  saveHighlight.mockResolvedValue({ id: 'h1', color: 'yellow', note: null,
    anchor: { page: 1, rects: [{ x: 0, y: 0, w: 0.5, h: 0.05 }], text: 'hi' },
    user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' })
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  act(() => { (pdfProps.current?.onSelect as (s: unknown) => void)(
    { rects: [{ x: 0, y: 0, w: 0.5, h: 0.05 }], text: 'hi', x: 20, y: 20 }) })
  await userEvent.click(await screen.findByRole('button', { name: /yellow/i }))
  await waitFor(() => expect(saveHighlight).toHaveBeenCalledWith('b1', expect.objectContaining({
    color: 'yellow',
    anchor: expect.objectContaining({ page: 1, text: 'hi' }),
  })))
})

test('shows PDF highlights in the Highlights tab and jumps to the page', async () => {
  listHighlights.mockResolvedValue([
    { id: 'h1', color: 'green', note: null,
      anchor: { page: 4, rects: [{ x: 0, y: 0, w: 0.4, h: 0.05 }], text: 'later bit' },
      user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' },
  ])
  renderAt('b1')
  await screen.findByTestId('pdf-page')
  await userEvent.click(screen.getByRole('button', { name: /bookmarks/i })) // opens the sidebar
  await userEvent.click(await screen.findByRole('button', { name: 'Highlights' }))
  await userEvent.click(await screen.findByText(/later bit/))
  expect(screen.getByTestId('pdf-page')).toHaveTextContent('page 4')
})
```
(Adapt the PdfViewer mock so it exposes its props via a `pdfProps` hoisted ref — mirror how the EpubReader test exposes `viewerProps`. The sidebar-toggle button in the PDF toolbar has `aria-label="Bookmarks"`.)

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement PDF highlight orchestration in ReaderPage**

In `src/frontend/pages/ReaderPage.tsx` (PDF branch only):
- Import highlights repo + `HighlightPopover` + `HighlightsPanel` + `NormRect`.
- State: `const [highlights, setHighlights] = useState<Highlight[]>([])`, `const [popover, setPopover] = useState<null | { mode: 'create'|'edit'; x: number; y: number; rects?: NormRect[]; text?: string; id?: string; color?: string; note?: string | null }>(null)`.
- Load highlights for PDFs (effect keyed on `[bookId, book?.format]`, only when `format === 'pdf'`): `listHighlights(bookId).then(setHighlights)`.
- Current-page highlights for the viewer:
  ```tsx
  const pageHighlights = highlights
    .filter((h) => (h.anchor as { page?: number }).page === page)
    .map((h) => ({ id: h.id, color: h.color, rects: ((h.anchor as { rects?: NormRect[] }).rects) ?? [] }))
  ```
- Pass to `<PdfViewer>`: `highlights={pageHighlights}`,
  `onSelect={(s) => setPopover({ mode: 'create', x: s.x, y: s.y, rects: s.rects, text: s.text })}`,
  `onHighlightClick={(id, x, y) => { const h = highlights.find((v) => v.id === id); if (h) setPopover({ mode: 'edit', x, y, id, color: h.color, note: h.note }) }}`.
- Handlers (mirror the EPUB reader's, but anchor is `{ page, rects, text }`):
  ```tsx
  async function createHighlight(color: string) {
    if (!popover?.rects) return
    const saved = await saveHighlight(book!.id, {
      color, anchor: { page, rects: popover.rects, text: popover.text ?? '' },
    })
    setHighlights((prev) => [...prev, saved]); setPopover(null)
  }
  async function changeColor(color: string) { if (!popover?.id) return; await updateHighlight(popover.id, { color }); setHighlights((p) => p.map((h) => h.id === popover.id ? { ...h, color } : h)); setPopover(null) }
  async function saveNote(note: string) { if (!popover?.id) return; await updateHighlight(popover.id, { note }); setHighlights((p) => p.map((h) => h.id === popover.id ? { ...h, note } : h)); setPopover(null) }
  async function removeHighlight(id: string) { await deleteHighlight(id); setHighlights((p) => p.filter((h) => h.id !== id)); setPopover(null) }
  ```
- Render the popover when set (same as EpubReader; branch onPickColor between create/edit).
- Add a **Highlights** tab to the PDF `ReaderSidebar` tabs array, after Bookmarks:
  ```tsx
  { key: 'highlights', label: 'Highlights', render: () => (
    <HighlightsPanel
      highlights={highlights}
      onJump={(h) => { const p = (h.anchor as { page?: number }).page; if (p) setPage(p) }}
      onDelete={removeHighlight}
    />
  ) }
  ```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: PDF highlight create/edit/delete + Highlights sidebar tab"
```

---

## Self-Review

**Spec coverage (PDF slice of roadmap M4b):**
- Select text on a PDF → color popover → highlight → Task 2 (text layer + selection) + Task 3 (create). ✓
- Notes, recolor, remove by clicking a highlight → Task 3 (edit popover, reusing HighlightPopover). ✓
- Highlights panel, filter by color, jump to page → Task 3 (Highlights tab, reusing HighlightsPanel). ✓
- PDF anchoring via normalized text-layer rects → Task 1 (geometry) + Task 2 (overlays by %). ✓
- Reuses the highlights repo + popover + panel + palette from M4b-1. ✓

**Placeholder scan:** all code steps complete except the react-pdf TextLayer CSS import path, flagged to confirm against react-pdf@10 (the only browser-version-dependent detail).

**Type consistency:** `NormRect` from `pdfHighlightGeometry` used by PdfViewer + ReaderPage; `Highlight` from `@shared/types`; PDF anchor shape `{ page, rects, text }` consistent across save/render/jump; palette keys shared via `highlightColors`.

**Test isolation:** react-pdf/pdfjs can't render a real page or produce real selection rects in jsdom, so PdfViewer's selection uses a stubbed `window.getSelection` + mocked wrapper geometry, and ReaderPage mocks `PdfViewer`. The real select→popover→overlay flow and pixel alignment are verified in the Milestone manual check (select text on a PDF page → popover → pick color → overlay appears aligned to the text; zoom → overlay stays aligned; click overlay → edit/remove; reload → persists; Highlights tab jumps to the page).
