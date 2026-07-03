# Milestone 4b-1: EPUB Highlights — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select text in an EPUB and highlight it in a preset color via a popover; add a note; edit color / note / delete by clicking a highlight; see all highlights in a Highlights sidebar tab (filter by color, click to jump). Persisted per user.

**Architecture:** A format-agnostic `highlights` repository (`@backend/data/highlights`) reusing the `highlights` table (`anchor` JSON = EPUB `{ cfiRange, text }`). Selection + highlight rendering use **epub.js annotations** (`rendition.on('selected')`, `rendition.annotations`), isolated inside `EpubViewer`. A shared `HighlightPopover` (color swatches + note) and `HighlightsPanel` (Highlights tab). PDF highlights are a separate later slice (M4b-2) that reuse the same repo + panel + popover.

**Tech Stack:** existing React 19 / Vite / TS / Tailwind / Supabase / Vitest + epubjs.

## Global Constraints

- **Repository pattern:** reader UI reads/writes highlights only via `@backend/data/highlights`, never `@backend/supabase`.
- **EPUB highlight anchor** = `{ cfiRange: string, text: string }` stored in the `highlights.anchor` jsonb column; `color` is a palette key (`'yellow' | 'green' | 'pink' | 'blue'`).
- epub.js is isolated in `EpubViewer` and mocked above it. Selection/annotation positioning runs in a real iframe jsdom can't drive — those bits are verified in the manual check; unit tests mock them.
- Folder split + alias imports; test `vi.mock()` paths match import paths.
- TypeScript strict, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` green.
- Don't disturb existing reader features (bookmarks, progress, TOC, theme, resume). The Highlights tab is added alongside Contents + Bookmarks in the existing `ReaderSidebar`.

---

### Task 1: Highlights repository

**Files:**
- Create: `src/backend/data/highlights.ts`
- Test: `src/backend/data/highlights.test.ts`

**Interfaces:**
- Consumes: `supabase`, `requireUserId` (`./currentUser`), `Highlight` (`@shared/types`).
- Produces:
  - `listHighlights(bookId: string): Promise<Highlight[]>` — the user's highlights for the book, oldest first.
  - `saveHighlight(bookId: string, fields: { color: string; note?: string | null; anchor: Record<string, unknown> }): Promise<Highlight>`
  - `updateHighlight(id: string, fields: { color?: string; note?: string | null }): Promise<void>`
  - `deleteHighlight(id: string): Promise<void>`

- [ ] **Step 1: Write the failing tests**

Create `src/backend/data/highlights.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { from } }))
vi.mock('./currentUser', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { listHighlights, saveHighlight, updateHighlight, deleteHighlight } from './highlights'

beforeEach(() => vi.clearAllMocks())

test('listHighlights returns the user rows ordered by created_at asc', async () => {
  const rows = [{ id: 'h1' }, { id: 'h2' }]
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ order }) }) })
  expect(await listHighlights('b1')).toEqual(rows)
  expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
})

test('saveHighlight inserts color/note/anchor for the user+book', async () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'h1' }, error: null })
  const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
  from.mockReturnValue({ insert })
  const anchor = { cfiRange: 'epubcfi(/6/4!/2,/1:0,/1:5)', text: 'hello' }
  const h = await saveHighlight('b1', { color: 'yellow', anchor })
  expect(h).toEqual({ id: 'h1' })
  expect(insert).toHaveBeenCalledWith({
    user_id: 'u1', book_id: 'b1', color: 'yellow', note: null, anchor,
  })
})

test('updateHighlight updates the given fields by id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  from.mockReturnValue({ update })
  await updateHighlight('h1', { color: 'green', note: 'nice' })
  expect(update).toHaveBeenCalledWith({ color: 'green', note: 'nice' })
  expect(eq).toHaveBeenCalledWith('id', 'h1')
})

test('deleteHighlight deletes by id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ delete: () => ({ eq }) })
  await deleteHighlight('h1')
  expect(eq).toHaveBeenCalledWith('id', 'h1')
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/backend/data/highlights.test.ts`
Expected: FAIL — `./highlights` not found.

- [ ] **Step 3: Implement**

Create `src/backend/data/highlights.ts`:
```ts
import { supabase } from '@backend/supabase'
import { requireUserId } from './currentUser'
import type { Highlight } from '@shared/types'

export async function listHighlights(bookId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('book_id', bookId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Highlight[]
}

export async function saveHighlight(
  bookId: string,
  fields: { color: string; note?: string | null; anchor: Record<string, unknown> },
): Promise<Highlight> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      user_id: userId,
      book_id: bookId,
      color: fields.color,
      note: fields.note ?? null,
      anchor: fields.anchor,
    })
    .select()
    .single()
  if (error) throw error
  return data as Highlight
}

export async function updateHighlight(
  id: string,
  fields: { color?: string; note?: string | null },
): Promise<void> {
  const { error } = await supabase.from('highlights').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase.from('highlights').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/backend/data/highlights.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add highlights repository (list/save/update/delete)"
```

---

### Task 2: Highlight colors + HighlightPopover

**Files:**
- Create: `src/frontend/reader/highlightColors.ts`, `src/frontend/reader/HighlightPopover.tsx`
- Test: `src/frontend/reader/HighlightPopover.test.tsx`

**Interfaces:**
- Produces:
  - `highlightColors.ts`: `HIGHLIGHT_COLORS: Array<{ key: string; label: string; value: string }>` (yellow/green/pink/blue with hex values) and `colorValue(key: string): string` (hex for a key, falling back to the first color).
  - `HighlightPopover.tsx`: `HighlightPopover` with props:
    ```ts
    {
      x: number; y: number                     // fixed position (viewport coords)
      mode: 'create' | 'edit'
      color?: string                           // current color (edit mode)
      note?: string | null                     // current note (edit mode)
      onPickColor: (key: string) => void
      onSaveNote?: (note: string) => void      // edit mode
      onDelete?: () => void                    // edit mode
      onClose: () => void
    }
    ```
    A small floating card at (x, y): a row of color swatch buttons (aria-label = the color label); in `edit` mode also a note `<textarea>` with a Save button and a Delete button. Closes on Escape and on outside click.

- [ ] **Step 1: Implement highlightColors.ts (no test needed — trivial data; covered via popover)**

Create `src/frontend/reader/highlightColors.ts`:
```ts
export interface HighlightColor {
  key: string
  label: string
  value: string
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { key: 'yellow', label: 'Yellow', value: '#fde047' },
  { key: 'green', label: 'Green', value: '#86efac' },
  { key: 'pink', label: 'Pink', value: '#f9a8d4' },
  { key: 'blue', label: 'Blue', value: '#93c5fd' },
]

export function colorValue(key: string): string {
  return HIGHLIGHT_COLORS.find((c) => c.key === key)?.value ?? HIGHLIGHT_COLORS[0].value
}
```

- [ ] **Step 2: Write the failing HighlightPopover test**

Create `src/frontend/reader/HighlightPopover.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { HighlightPopover } from './HighlightPopover'

test('create mode: picks a color', async () => {
  const onPickColor = vi.fn()
  render(<HighlightPopover x={10} y={10} mode="create" onPickColor={onPickColor} onClose={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /green/i }))
  expect(onPickColor).toHaveBeenCalledWith('green')
})

test('edit mode: saves a note and deletes', async () => {
  const onSaveNote = vi.fn(); const onDelete = vi.fn()
  render(
    <HighlightPopover x={0} y={0} mode="edit" color="yellow" note="old"
      onPickColor={() => {}} onSaveNote={onSaveNote} onDelete={onDelete} onClose={() => {}} />,
  )
  const box = screen.getByRole('textbox')
  await userEvent.clear(box)
  await userEvent.type(box, 'my note')
  await userEvent.click(screen.getByRole('button', { name: /save note/i }))
  expect(onSaveNote).toHaveBeenCalledWith('my note')
  await userEvent.click(screen.getByRole('button', { name: /delete/i }))
  expect(onDelete).toHaveBeenCalled()
})

test('closes on Escape', async () => {
  const onClose = vi.fn()
  render(<HighlightPopover x={0} y={0} mode="create" onPickColor={() => {}} onClose={onClose} />)
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 3: Run — verify it fails**

Run: `bun run test src/frontend/reader/HighlightPopover.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement HighlightPopover**

Create `src/frontend/reader/HighlightPopover.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { HIGHLIGHT_COLORS } from './highlightColors'

export interface HighlightPopoverProps {
  x: number
  y: number
  mode: 'create' | 'edit'
  color?: string
  note?: string | null
  onPickColor: (key: string) => void
  onSaveNote?: (note: string) => void
  onDelete?: () => void
  onClose: () => void
}

export function HighlightPopover({
  x, y, mode, color, note, onPickColor, onSaveNote, onDelete, onClose,
}: HighlightPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState(note ?? '')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => window.addEventListener('mousedown', onDown), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      clearTimeout(t)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="dialog"
      className="fixed z-50 -translate-x-1/2 rounded-lg border bg-white p-2 shadow-lg"
      style={{ left: x, top: y }}
    >
      <div className="flex items-center gap-1">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.label}
            onClick={() => onPickColor(c.key)}
            className={`h-6 w-6 rounded-full border ${color === c.key ? 'ring-2 ring-black' : ''}`}
            style={{ backgroundColor: c.value }}
          />
        ))}
      </div>
      {mode === 'edit' && (
        <div className="mt-2 w-56">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            className="h-16 w-full rounded border p-1 text-sm"
          />
          <div className="mt-1 flex justify-between">
            <button type="button" onClick={() => onDelete?.()} className="text-sm text-red-600">Delete</button>
            <button
              type="button"
              onClick={() => onSaveNote?.(draft)}
              className="rounded bg-black px-2 py-1 text-sm text-white"
            >
              Save note
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run — verify it passes**

Run: `bun run test src/frontend/reader/HighlightPopover.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add highlight color palette and create/edit popover"
```

---

### Task 3: HighlightsPanel (Highlights tab body)

**Files:**
- Create: `src/frontend/reader/HighlightsPanel.tsx`
- Test: `src/frontend/reader/HighlightsPanel.test.tsx`

**Interfaces:**
- Consumes: `Highlight` (`@shared/types`), `HIGHLIGHT_COLORS`/`colorValue` (`./highlightColors`).
- Produces: `HighlightsPanel` with props `{ highlights: Highlight[]; onJump: (h: Highlight) => void; onDelete: (id: string) => void }`. Lists each highlight (a color dot + the anchor's `text` snippet + the note if any); a color filter (All + one chip per color) narrows the list; clicking a row calls `onJump`; a delete control calls `onDelete`; empty state.

- [ ] **Step 1: Write the failing test**

Create `src/frontend/reader/HighlightsPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { HighlightsPanel } from './HighlightsPanel'
import type { Highlight } from '@shared/types'

function h(id: string, color: string, text: string, note: string | null = null): Highlight {
  return { id, user_id: 'u1', book_id: 'b1', color, note, anchor: { text }, created_at: '', updated_at: '' }
}

const items = [h('h1', 'yellow', 'first bit'), h('h2', 'green', 'second bit', 'a note')]

test('lists highlights with text and note, and jumps on click', async () => {
  const onJump = vi.fn()
  render(<HighlightsPanel highlights={items} onJump={onJump} onDelete={() => {}} />)
  expect(screen.getByText(/first bit/)).toBeInTheDocument()
  expect(screen.getByText(/a note/)).toBeInTheDocument()
  await userEvent.click(screen.getByText(/first bit/))
  expect(onJump).toHaveBeenCalledWith(items[0])
})

test('filters by color', async () => {
  render(<HighlightsPanel highlights={items} onJump={() => {}} onDelete={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: /^green$/i }))
  expect(screen.queryByText(/first bit/)).not.toBeInTheDocument()
  expect(screen.getByText(/second bit/)).toBeInTheDocument()
})

test('deletes on the delete control', async () => {
  const onDelete = vi.fn()
  render(<HighlightsPanel highlights={items} onJump={() => {}} onDelete={onDelete} />)
  await userEvent.click(screen.getAllByRole('button', { name: /delete highlight/i })[0])
  expect(onDelete).toHaveBeenCalledWith('h1')
})

test('shows empty state', () => {
  render(<HighlightsPanel highlights={[]} onJump={() => {}} onDelete={() => {}} />)
  expect(screen.getByText(/no highlights/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/HighlightsPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement HighlightsPanel**

Create `src/frontend/reader/HighlightsPanel.tsx`:
```tsx
import { useState } from 'react'
import type { Highlight } from '@shared/types'
import { HIGHLIGHT_COLORS, colorValue } from './highlightColors'

export function HighlightsPanel({
  highlights, onJump, onDelete,
}: {
  highlights: Highlight[]
  onJump: (h: Highlight) => void
  onDelete: (id: string) => void
}) {
  const [filter, setFilter] = useState<string | null>(null)
  const shown = filter ? highlights.filter((h) => h.color === filter) : highlights

  return (
    <div className="text-sm">
      <div className="flex flex-wrap gap-1 border-b p-2">
        <button
          type="button"
          onClick={() => setFilter(null)}
          className={`rounded px-2 py-0.5 text-xs ${filter === null ? 'bg-gray-200' : ''}`}
        >
          All
        </button>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-label={c.label}
            onClick={() => setFilter(c.key)}
            className={`rounded px-2 py-0.5 text-xs ${filter === c.key ? 'ring-2 ring-black' : ''}`}
            style={{ backgroundColor: c.value }}
          >
            {c.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="p-3 text-gray-400">No highlights yet.</p>
      ) : (
        <ul className="p-2">
          {shown.map((hl) => {
            const text = String((hl.anchor as { text?: string })?.text ?? '')
            return (
              <li key={hl.id} className="group flex items-start gap-2 rounded px-2 py-1 hover:bg-gray-100">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colorValue(hl.color) }}
                />
                <button type="button" onClick={() => onJump(hl)} className="flex-1 text-left">
                  <span className="line-clamp-2">{text || '(highlight)'}</span>
                  {hl.note && <span className="mt-0.5 block text-xs text-gray-500">{hl.note}</span>}
                </button>
                <button
                  type="button"
                  aria-label="Delete highlight"
                  onClick={() => onDelete(hl.id)}
                  className="text-red-600 opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/HighlightsPanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add highlights panel with color filter, jump, and delete"
```

---

### Task 4: EpubViewer highlight API (epub.js selection + annotations)

**Files:**
- Modify: `src/frontend/reader/EpubViewer.tsx`
- Test: `src/frontend/reader/EpubViewer.test.tsx` (extend)

**Interfaces:**
- Adds to `EpubViewerProps`:
  - `highlights?: Array<{ id: string; cfiRange: string; color: string }>` — currently-saved highlights to render as annotations.
  - `onSelect?: (sel: { cfiRange: string; text: string; x: number; y: number }) => void` — fired when the user selects text.
  - `onHighlightClick?: (id: string, x: number, y: number) => void` — fired when a rendered highlight is clicked.
- Behavior:
  - On `rendition.on('selected', (cfiRange, contents) => …)`: compute the selected text and a viewport position from the selection rect + the iframe offset, then call `onSelect`. Clear the browser selection after reporting (so the popover isn't fighting the native selection).
  - Apply the `highlights` prop as epub.js annotations: for each, `rendition.annotations.add('highlight', cfiRange, { id }, () => onHighlightClickRef.current?.(id, x, y), \`hl-\${id}\`, { fill: colorValue(color), 'fill-opacity': '0.35', 'mix-blend-mode': 'multiply' })`. Track applied ids in a ref `Map<id, cfiRange>`; when the prop changes, remove annotations whose id is gone (`rendition.annotations.remove(cfiRange, 'highlight')`) and add new ones; if a color changed, remove+re-add. Apply after `display()` (and re-run when `highlights` changes).
  - All callbacks via latest-refs (same pattern as `onRelocated`/`onToc`).

**Note (live-tuning expected):** epub.js 0.3.93's exact `annotations.add` signature, the `selected` payload, and the callback's event shape should be confirmed against `node_modules/epubjs/src/annotations.js` and `rendition.js`. Implement the position helper to read the selection rect from `contents.window.getSelection().getRangeAt(0).getBoundingClientRect()` plus `contents.window.frameElement.getBoundingClientRect()` offset. If the annotation click callback doesn't provide coordinates, position the edit popover at the clicked highlight's mark rect (or fall back to the center of the viewer). These pixel details can only be verified in the browser; keep them in small, clearly-named helpers.

- [ ] **Step 1: Extend the test mock + write failing tests**

In `src/frontend/reader/EpubViewer.test.tsx`, extend the fake `rendition` with a `selected` handler capture and an `annotations` object, and the fake `book`/`contents` enough to drive selection:
```tsx
// add to the hoisted rendition:
annotations: { add: vi.fn(), remove: vi.fn() },
// extend `on` to also capture 'selected':
on: vi.fn((event, cb) => {
  if (event === 'relocated') relocatedHandlers.push(cb)
  if (event === 'selected') selectedHandlers.push(cb)
}),
```
(Declare `selectedHandlers` in the hoisted block and reset it in `beforeEach`, like `relocatedHandlers`.)
Add tests:
```tsx
test('applies saved highlights as annotations', async () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      highlights={[{ id: 'h1', cfiRange: 'epubcfi(range1)', color: 'yellow' }]}
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  await vi.waitFor(() =>
    expect(rendition.annotations.add).toHaveBeenCalledWith(
      'highlight', 'epubcfi(range1)', expect.any(Object), expect.any(Function),
      'hl-h1', expect.objectContaining({ fill: expect.any(String) }),
    ),
  )
})

test('reports a text selection via onSelect', async () => {
  const onSelect = vi.fn()
  // Provide a fake contents with a selection + frameElement offset.
  const fakeContents = {
    window: {
      getSelection: () => ({
        toString: () => 'selected words',
        getRangeAt: () => ({ getBoundingClientRect: () => ({ left: 100, top: 50, width: 40, height: 12 }) }),
        removeAllRanges: () => {},
      }),
      frameElement: { getBoundingClientRect: () => ({ left: 10, top: 20 }) },
    },
  }
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} onSelect={onSelect} />,
  )
  await vi.waitFor(() => expect(selectedHandlers.length).toBeGreaterThan(0))
  selectedHandlers[0]?.('epubcfi(sel)', fakeContents)
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
    cfiRange: 'epubcfi(sel)', text: 'selected words',
  }))
})
```

- [ ] **Step 2: Run — verify the new tests fail**

Run: `bun run test src/frontend/reader/EpubViewer.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement the highlight API in EpubViewer**

Add props + latest-refs for `onSelect`/`onHighlightClick`; import `colorValue` from `./highlightColors`. In the create-effect, after `rendition.display(...)`, register the `selected` handler and apply highlights. Add a `selectionPosition(contents)` helper (module scope):
```ts
function selectionPosition(contents: {
  window: {
    getSelection: () => { getRangeAt: (i: number) => { getBoundingClientRect: () => DOMRect } } | null
    frameElement?: { getBoundingClientRect: () => { left: number; top: number } } | null
  }
}): { x: number; y: number } {
  const sel = contents.window.getSelection()
  const rect = sel?.getRangeAt(0).getBoundingClientRect()
  const frame = contents.window.frameElement?.getBoundingClientRect()
  const fx = frame?.left ?? 0
  const fy = frame?.top ?? 0
  return { x: fx + (rect?.left ?? 0) + (rect?.width ?? 0) / 2, y: fy + (rect?.top ?? 0) }
}
```
`selected` handler:
```ts
rendition.on('selected', (cfiRange: string, contents: Parameters<typeof selectionPosition>[0] & {
  window: { getSelection: () => { toString: () => string; removeAllRanges: () => void } | null }
}) => {
  const text = contents.window.getSelection()?.toString() ?? ''
  const { x, y } = selectionPosition(contents)
  onSelectRef.current?.({ cfiRange, text, x, y })
})
```
Apply highlights (add an effect-like sync inside the create-effect AND a separate effect keyed on `highlights`). Keep a `appliedRef = useRef(new Map<string, string>())` (id → cfiRange). A `syncAnnotations()` function:
```ts
function syncAnnotations(rendition, highlights, applied, onHighlightClick) {
  const next = new Map(highlights.map((h) => [h.id, h.cfiRange]))
  // remove gone / changed
  for (const [id, cfi] of applied) {
    if (!next.has(id)) { rendition.annotations.remove(cfi, 'highlight'); applied.delete(id) }
  }
  // add new
  for (const h of highlights) {
    if (applied.get(h.id) === h.cfiRange) continue
    if (applied.has(h.id)) rendition.annotations.remove(applied.get(h.id)!, 'highlight')
    rendition.annotations.add('highlight', h.cfiRange, { id: h.id },
      () => onHighlightClick.current?.(h.id, 0, 0),
      `hl-${h.id}`, { fill: colorValue(h.color), 'fill-opacity': '0.35', 'mix-blend-mode': 'multiply' })
    applied.set(h.id, h.cfiRange)
  }
}
```
Call `syncAnnotations` after display and in a `useEffect` on `[highlights]` (guarded by `renditionRef.current`). For the click position, pass `0, 0` for now — EpubReader can position the edit popover at a sensible default or the mark rect (note this is browser-tuned).

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/EpubViewer.test.tsx`
Expected: PASS (incl. the two new tests).

- [ ] **Step 5: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: EpubViewer selection + annotation API for highlights"
```

---

### Task 5: EpubReader highlight orchestration + Highlights tab

**Files:**
- Modify: `src/frontend/reader/EpubReader.tsx`
- Test: `src/frontend/reader/EpubReader.test.tsx` (extend)

**Interfaces:**
- Consumes: `listHighlights`, `saveHighlight`, `updateHighlight`, `deleteHighlight` (`@backend/data/highlights`), `HighlightPopover`, `HighlightsPanel`.
- Produces: EPUB reader loads highlights; passes them to `EpubViewer` (as `{ id, cfiRange, color }`); on `onSelect` shows a create `HighlightPopover`; picking a color saves + the new highlight renders; on `onHighlightClick` shows an edit popover (change color / save note / delete); adds a **Highlights** tab to the `ReaderSidebar` (list, filter, jump via `goTo(cfiRange)`, delete).

- [ ] **Step 1: Extend EpubReader tests**

In `src/frontend/reader/EpubReader.test.tsx`, add a hoisted mock for `@backend/data/highlights` (listHighlights→[], saveHighlight→a row, updateHighlight, deleteHighlight). The EpubViewer mock already captures its props (`viewerProps.current`), so drive `onSelect`. Add:
```tsx
test('creates a highlight from a selection', async () => {
  saveHighlight.mockResolvedValue({ id: 'h1', color: 'yellow', anchor: { cfiRange: 'epubcfi(sel)', text: 'hi' }, note: null, user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' })
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  act(() => { (viewerProps.current?.onSelect as (s: unknown) => void)({ cfiRange: 'epubcfi(sel)', text: 'hi', x: 20, y: 20 }) })
  await userEvent.click(await screen.findByRole('button', { name: /yellow/i }))
  await waitFor(() => expect(saveHighlight).toHaveBeenCalledWith('b1', expect.objectContaining({
    color: 'yellow', anchor: expect.objectContaining({ cfiRange: 'epubcfi(sel)', text: 'hi' }),
  })))
})

test('shows highlights in the Highlights tab and jumps', async () => {
  listHighlights.mockResolvedValue([
    { id: 'h1', color: 'green', note: null, anchor: { cfiRange: 'epubcfi(hl1)', text: 'saved bit' }, user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' },
  ])
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Highlights' }))
  await userEvent.click(await screen.findByText(/saved bit/))
  expect(goTo).toHaveBeenCalledWith('epubcfi(hl1)')
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/EpubReader.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement highlight orchestration in EpubReader**

In `src/frontend/reader/EpubReader.tsx`:
- Import the highlights repo, `HighlightPopover`, `HighlightsPanel`, and `Highlight` type.
- State: `const [highlights, setHighlights] = useState<Highlight[]>([])`, `const [popover, setPopover] = useState<null | { mode: 'create'|'edit'; x: number; y: number; cfiRange?: string; text?: string; id?: string; color?: string; note?: string | null }>(null)`.
- Load: `useEffect(() => { listHighlights(bookId).then(setHighlights).catch(() => {}) }, [bookId])`.
- Derive the viewer prop: `const viewerHighlights = highlights.map((h) => ({ id: h.id, cfiRange: String((h.anchor as { cfiRange?: string }).cfiRange ?? ''), color: h.color }))`.
- Pass to `<EpubViewer>`: `highlights={viewerHighlights}`, `onSelect={(s) => setPopover({ mode: 'create', x: s.x, y: s.y, cfiRange: s.cfiRange, text: s.text })}`, `onHighlightClick={(id, x, y) => { const h = highlights.find((v) => v.id === id); if (h) setPopover({ mode: 'edit', x, y, id, color: h.color, note: h.note }) }}`.
- Handlers:
  ```tsx
  async function createHighlight(color: string) {
    if (!popover?.cfiRange) return
    const bm = await saveHighlight(bookId, { color, anchor: { cfiRange: popover.cfiRange, text: popover.text ?? '' } })
    setHighlights((prev) => [...prev, bm]); setPopover(null)
  }
  async function changeColor(color: string) {
    if (!popover?.id) return
    await updateHighlight(popover.id, { color })
    setHighlights((prev) => prev.map((h) => h.id === popover.id ? { ...h, color } : h)); setPopover(null)
  }
  async function saveNote(note: string) {
    if (!popover?.id) return
    await updateHighlight(popover.id, { note })
    setHighlights((prev) => prev.map((h) => h.id === popover.id ? { ...h, note } : h)); setPopover(null)
  }
  async function removeHighlight(id: string) {
    await deleteHighlight(id)
    setHighlights((prev) => prev.filter((h) => h.id !== id)); setPopover(null)
  }
  ```
- Render the popover when `popover` is set:
  ```tsx
  {popover && (
    <HighlightPopover
      x={popover.x} y={popover.y} mode={popover.mode}
      color={popover.color} note={popover.note}
      onPickColor={(c) => { void (popover.mode === 'create' ? createHighlight(c) : changeColor(c)) }}
      onSaveNote={(n) => { void saveNote(n) }}
      onDelete={() => { if (popover.id) void removeHighlight(popover.id) }}
      onClose={() => setPopover(null)}
    />
  )}
  ```
- Add a third sidebar tab:
  ```tsx
  { key: 'highlights', label: 'Highlights', render: () => (
    <HighlightsPanel
      highlights={highlights}
      onJump={(h) => viewerRef.current?.goTo(String((h.anchor as { cfiRange?: string }).cfiRange ?? ''))}
      onDelete={removeHighlight}
    />
  ) },
  ```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/EpubReader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: EPUB highlight create/edit/delete + Highlights sidebar tab"
```

---

## Self-Review

**Spec coverage (EPUB slice of roadmap M4b):**
- Highlight pen (preset colors) over text → select → `HighlightPopover` color pick (Task 2) + EpubViewer selection (Task 4) + create (Task 5). ✓ (interaction = select-then-popover, per the approved decision)
- Notes → edit popover note field (Task 2) + `saveNote` (Task 5). ✓
- Highlights panel, filter by color, jump → Task 3 + Highlights tab (Task 5). ✓
- Edit color / delete → edit popover (Task 2) + `changeColor`/`removeHighlight` (Task 5). ✓
- EPUB anchoring via CFI ranges + epub.js annotations → Task 4. ✓
- PDF highlights → **M4b-2 (separate plan)**, reusing the repo + popover + panel.

**Placeholder scan:** every step has complete code except the epub.js pixel-positioning helpers in Task 4, which are explicitly flagged as browser-tuned (isolated in `selectionPosition` + the annotation click position) — the same live-tuning pattern used for images/themes.

**Type consistency:** `Highlight` from `@shared/types` throughout; repo signatures (`listHighlights/saveHighlight/updateHighlight/deleteHighlight`) match call sites; EpubViewer highlight shape `{ id, cfiRange, color }` derived consistently from `Highlight.anchor.cfiRange`; palette keys (`yellow/green/pink/blue`) shared via `highlightColors.ts`.

**Test isolation:** epub.js selection/annotation positioning can't run in jsdom, so `EpubViewer` mocks the `selected` handler + `annotations`, and `EpubReader` mocks `EpubViewer`. The real selection→popover→highlight flow and pixel positioning are verified in the Milestone manual check (select text → popover → pick color → highlight appears; click highlight → edit/delete; reload → highlights persist and re-render).
