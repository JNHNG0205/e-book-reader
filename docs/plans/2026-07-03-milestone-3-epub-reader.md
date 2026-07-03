# Milestone 3: EPUB Reader — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open an EPUB from the library and read it — reflowable rendering (epub.js), previous/next navigation, adjustable font size, light/dark/sepia theme, a table-of-contents panel, and reading position that saves and resumes.

**Architecture:** Reuse the Milestone 2 reader shell — the `/read/:bookId` route and `ReaderPage` already branch on `book.format`. This milestone replaces the EPUB "not supported yet" placeholder with an `EpubReader` container. epub.js is isolated inside an `EpubViewer` component (exposing imperative `next`/`prev`/`goTo` via a ref, applying font-size/theme, reporting location + TOC) so it can be mocked in tests — epub.js renders into iframes that jsdom can't drive, exactly like react-pdf in M2. Reading position for EPUB is a **CFI string** stored via the existing `@backend/data/progress` repository (format-agnostic; PDF stored a page number, EPUB stores a CFI).

**Tech Stack:** epubjs, plus the existing React 19 / Vite / TS / Tailwind / Supabase / Vitest stack.

## Global Constraints

- **Folder split + aliases:** UI under `src/frontend/` (reader pieces in `src/frontend/reader/`), data-access under `src/backend/data/` (`@backend`), types in `@shared/types`. Cross-layer imports use the alias; test `vi.mock()` paths match the import path exactly.
- **Repository pattern:** the reader reads/writes files + progress ONLY through `@backend/data/*`, never `@backend/supabase`.
- **EPUB location = CFI string** (stored in `reading_progress.location`, reusing `getProgress`/`saveProgress` unchanged).
- **epub.js is isolated in `EpubViewer`** and mocked in every test above it (it needs a real DOM/iframe jsdom lacks). No test renders real epub.js.
- **Reader settings (font size, theme) persist in `localStorage`** so they carry across books/sessions.
- TypeScript strict ON, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` must stay green.
- Do not disturb the PDF path built in M2 — the PDF branch of `ReaderPage` stays as-is; this milestone only fills in the EPUB branch.

---

### Task 1: EpubViewer (epub.js wrapper)

**Files:**
- Modify: `package.json` (add `epubjs`)
- Create: `src/frontend/reader/epubToc.ts` (TOC flattening + `TocItem` type), `src/frontend/reader/EpubViewer.tsx`
- Test: `src/frontend/reader/epubToc.test.ts`, `src/frontend/reader/EpubViewer.test.tsx`

**Interfaces:**
- Consumes: `epubjs` (default export `ePub`).
- Produces:
  - `epubToc.ts`: `interface TocItem { label: string; href: string; level: number }` and `flattenToc(navToc: NavItem[]): TocItem[]` (depth-first, `level` starts at 0; nested `subitems` increment level).
  - `EpubViewer.tsx`: `interface EpubViewerHandle { next(): void; prev(): void; goTo(target: string): void }`, `interface EpubViewerProps { fileUrl: string; initialCfi?: string | null; fontSize: number; theme: EpubTheme; onRelocated: (cfi: string) => void; onToc: (toc: TocItem[]) => void }`, `type EpubTheme = 'light' | 'dark' | 'sepia'`. A `forwardRef` component exposing the handle.

- [ ] **Step 1: Install epubjs**

Run: `bun add epubjs`
Expected: `epubjs` in `package.json` / `bun.lock`.

- [ ] **Step 2: Write the failing TOC-flatten test**

Create `src/frontend/reader/epubToc.test.ts`:
```ts
import { expect, test } from 'vitest'
import { flattenToc } from './epubToc'

test('flattens nested toc with increasing level', () => {
  const nav = [
    { label: 'Ch 1', href: 'c1.xhtml', subitems: [
      { label: 'Ch 1.1', href: 'c1.xhtml#s1', subitems: [] },
    ] },
    { label: 'Ch 2', href: 'c2.xhtml', subitems: [] },
  ]
  expect(flattenToc(nav)).toEqual([
    { label: 'Ch 1', href: 'c1.xhtml', level: 0 },
    { label: 'Ch 1.1', href: 'c1.xhtml#s1', level: 1 },
    { label: 'Ch 2', href: 'c2.xhtml', level: 0 },
  ])
})

test('trims labels and tolerates missing subitems', () => {
  const nav = [{ label: '  Intro  ', href: 'i.xhtml' }]
  expect(flattenToc(nav)).toEqual([{ label: 'Intro', href: 'i.xhtml', level: 0 }])
})
```

- [ ] **Step 3: Run — verify it fails**

Run: `bun run test src/frontend/reader/epubToc.test.ts`
Expected: FAIL — `./epubToc` not found.

- [ ] **Step 4: Implement epubToc.ts**

Create `src/frontend/reader/epubToc.ts`:
```ts
export interface TocItem {
  label: string
  href: string
  level: number
}

export interface NavItem {
  label: string
  href: string
  subitems?: NavItem[]
}

export function flattenToc(navToc: NavItem[], level = 0): TocItem[] {
  const out: TocItem[] = []
  for (const item of navToc) {
    out.push({ label: item.label.trim(), href: item.href, level })
    if (item.subitems && item.subitems.length > 0) {
      out.push(...flattenToc(item.subitems, level + 1))
    }
  }
  return out
}
```

- [ ] **Step 5: Run — verify it passes**

Run: `bun run test src/frontend/reader/epubToc.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Write the failing EpubViewer test (epubjs mocked)**

Create `src/frontend/reader/EpubViewer.test.tsx`:
```tsx
import { render } from '@testing-library/react'
import { createRef } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

// Shared fake rendition/book captured per test.
const { rendition, book, ePub, relocatedHandlers } = vi.hoisted(() => {
  const relocatedHandlers: Array<(loc: { start: { cfi: string } }) => void> = []
  const rendition = {
    display: vi.fn().mockResolvedValue(undefined),
    next: vi.fn(),
    prev: vi.fn(),
    on: vi.fn((event: string, cb: (loc: { start: { cfi: string } }) => void) => {
      if (event === 'relocated') relocatedHandlers.push(cb)
    }),
    themes: { fontSize: vi.fn(), register: vi.fn(), select: vi.fn() },
    destroy: vi.fn(),
  }
  const book = {
    renderTo: vi.fn(() => rendition),
    loaded: { navigation: Promise.resolve({ toc: [{ label: 'Ch 1', href: 'c1.xhtml', subitems: [] }] }) },
    destroy: vi.fn(),
  }
  const ePub = vi.fn(() => book)
  return { rendition, book, ePub, relocatedHandlers }
})
vi.mock('epubjs', () => ({ default: ePub }))

import { EpubViewer, type EpubViewerHandle } from './EpubViewer'

beforeEach(() => {
  vi.clearAllMocks()
  relocatedHandlers.length = 0
})

test('creates a book from the file url and displays the initial cfi', () => {
  render(
    <EpubViewer
      fileUrl="https://x/y.epub" initialCfi="epubcfi(/6/4!/2)"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}}
    />,
  )
  expect(ePub).toHaveBeenCalledWith('https://x/y.epub')
  expect(rendition.display).toHaveBeenCalledWith('epubcfi(/6/4!/2)')
})

test('exposes next/prev via the ref', () => {
  const ref = createRef<EpubViewerHandle>()
  render(
    <EpubViewer ref={ref} fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  ref.current!.next()
  ref.current!.prev()
  expect(rendition.next).toHaveBeenCalled()
  expect(rendition.prev).toHaveBeenCalled()
})

test('reports relocation as a cfi', () => {
  const onRelocated = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={onRelocated} onToc={() => {}} />,
  )
  relocatedHandlers[0]?.({ start: { cfi: 'epubcfi(/6/8!/4)' } })
  expect(onRelocated).toHaveBeenCalledWith('epubcfi(/6/8!/4)')
})

test('applies font size to the rendition themes', () => {
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={140} theme="light" onRelocated={() => {}} onToc={() => {}} />,
  )
  expect(rendition.themes.fontSize).toHaveBeenCalledWith('140%')
})

test('reports the flattened toc once navigation loads', async () => {
  const onToc = vi.fn()
  render(
    <EpubViewer fileUrl="https://x/y.epub"
      fontSize={100} theme="light" onRelocated={() => {}} onToc={onToc} />,
  )
  await Promise.resolve()
  await Promise.resolve()
  expect(onToc).toHaveBeenCalledWith([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
})
```

- [ ] **Step 7: Run — verify it fails**

Run: `bun run test src/frontend/reader/EpubViewer.test.tsx`
Expected: FAIL — `./EpubViewer` not found.

- [ ] **Step 8: Implement EpubViewer**

Create `src/frontend/reader/EpubViewer.tsx`:
```tsx
import {
  forwardRef, useEffect, useImperativeHandle, useRef,
} from 'react'
import ePub, { type Rendition } from 'epubjs'
import { flattenToc, type TocItem } from './epubToc'

export type EpubTheme = 'light' | 'dark' | 'sepia'

export interface EpubViewerHandle {
  next: () => void
  prev: () => void
  goTo: (target: string) => void
}

export interface EpubViewerProps {
  fileUrl: string
  initialCfi?: string | null
  fontSize: number
  theme: EpubTheme
  onRelocated: (cfi: string) => void
  onToc: (toc: TocItem[]) => void
}

const THEME_STYLES: Record<EpubTheme, Record<string, Record<string, string>>> = {
  light: { body: { background: '#ffffff', color: '#111111' } },
  dark: { body: { background: '#111111', color: '#e5e5e5' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  { fileUrl, initialCfi, fontSize, theme, onRelocated, onToc },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)

  useImperativeHandle(ref, () => ({
    next: () => renditionRef.current?.next(),
    prev: () => renditionRef.current?.prev(),
    goTo: (target: string) => { void renditionRef.current?.display(target) },
  }), [])

  // Create the book + rendition once per file.
  useEffect(() => {
    if (!containerRef.current) return
    const book = ePub(fileUrl)
    const rendition = book.renderTo(containerRef.current, {
      width: '100%', height: '100%', flow: 'paginated', spread: 'none',
    })
    renditionRef.current = rendition
    for (const [name, styles] of Object.entries(THEME_STYLES)) {
      rendition.themes.register(name, styles)
    }
    rendition.themes.select(theme)
    rendition.themes.fontSize(`${fontSize}%`)
    void rendition.display(initialCfi ?? undefined)
    rendition.on('relocated', (loc: { start: { cfi: string } }) => onRelocated(loc.start.cfi))
    void book.loaded.navigation.then((nav: { toc: Parameters<typeof flattenToc>[0] }) => {
      onToc(flattenToc(nav.toc))
    })
    return () => { book.destroy() }
    // Intentionally only re-create when the file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  // Apply font size when it changes.
  useEffect(() => { renditionRef.current?.themes.fontSize(`${fontSize}%`) }, [fontSize])
  // Apply theme when it changes.
  useEffect(() => { renditionRef.current?.themes.select(theme) }, [theme])

  return <div ref={containerRef} className="h-full w-full" data-testid="epub-container" />
})
```

- [ ] **Step 9: Run — verify it passes**

Run: `bun run test src/frontend/reader/EpubViewer.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 10: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add EpubViewer wrapping epub.js with toc flattening"
```

---

### Task 2: EpubToolbar

**Files:**
- Create: `src/frontend/reader/EpubToolbar.tsx`
- Test: `src/frontend/reader/EpubToolbar.test.tsx`

**Interfaces:**
- Produces: `EpubToolbar` with props `{ fontSize: number; theme: EpubTheme; onPrev: () => void; onNext: () => void; onFontSmaller: () => void; onFontLarger: () => void; onCycleTheme: () => void; onToggleToc: () => void; onBack: () => void }`. Buttons: Back, TOC toggle, Prev, Next, font smaller/larger (shows `fontSize%`), theme cycle (shows current theme). All `type="button"`, aria-labels: "Previous", "Next", "Smaller font", "Larger font", "Change theme", "Toggle contents".

- [ ] **Step 1: Write the failing test**

Create `src/frontend/reader/EpubToolbar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { EpubToolbar } from './EpubToolbar'

const props = {
  fontSize: 100, theme: 'light' as const,
  onPrev: vi.fn(), onNext: vi.fn(), onFontSmaller: vi.fn(), onFontLarger: vi.fn(),
  onCycleTheme: vi.fn(), onToggleToc: vi.fn(), onBack: vi.fn(),
}

test('shows the current font size', () => {
  render(<EpubToolbar {...props} fontSize={120} />)
  expect(screen.getByText(/120%/)).toBeInTheDocument()
})

test('fires font + theme callbacks', async () => {
  const onFontLarger = vi.fn(); const onCycleTheme = vi.fn()
  render(<EpubToolbar {...props} onFontLarger={onFontLarger} onCycleTheme={onCycleTheme} />)
  await userEvent.click(screen.getByRole('button', { name: /larger font/i }))
  await userEvent.click(screen.getByRole('button', { name: /change theme/i }))
  expect(onFontLarger).toHaveBeenCalled()
  expect(onCycleTheme).toHaveBeenCalled()
})

test('fires nav + toc + back callbacks', async () => {
  const onNext = vi.fn(); const onToggleToc = vi.fn(); const onBack = vi.fn()
  render(<EpubToolbar {...props} onNext={onNext} onToggleToc={onToggleToc} onBack={onBack} />)
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  await userEvent.click(screen.getByRole('button', { name: /library/i }))
  expect(onNext).toHaveBeenCalled()
  expect(onToggleToc).toHaveBeenCalled()
  expect(onBack).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/EpubToolbar.test.tsx`
Expected: FAIL — `./EpubToolbar` not found.

- [ ] **Step 3: Implement**

Create `src/frontend/reader/EpubToolbar.tsx`:
```tsx
import type { EpubTheme } from './EpubViewer'

export interface EpubToolbarProps {
  fontSize: number
  theme: EpubTheme
  onPrev: () => void
  onNext: () => void
  onFontSmaller: () => void
  onFontLarger: () => void
  onCycleTheme: () => void
  onToggleToc: () => void
  onBack: () => void
}

export function EpubToolbar({
  fontSize, theme, onPrev, onNext, onFontSmaller, onFontLarger,
  onCycleTheme, onToggleToc, onBack,
}: EpubToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b bg-white px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="text-blue-600">← Library</button>
        <button type="button" aria-label="Toggle contents" onClick={onToggleToc} className="rounded border px-2 py-1">☰</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Previous" onClick={onPrev} className="rounded border px-2 py-1">‹</button>
        <button type="button" aria-label="Next" onClick={onNext} className="rounded border px-2 py-1">›</button>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Smaller font" onClick={onFontSmaller} className="rounded border px-2 py-1">A−</button>
        <span>{fontSize}%</span>
        <button type="button" aria-label="Larger font" onClick={onFontLarger} className="rounded border px-2 py-1">A+</button>
        <button type="button" aria-label="Change theme" onClick={onCycleTheme} className="rounded border px-2 py-1 capitalize">{theme}</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/EpubToolbar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add epub reader toolbar (nav, font, theme, toc, back)"
```

---

### Task 3: TocPanel

**Files:**
- Create: `src/frontend/reader/TocPanel.tsx`
- Test: `src/frontend/reader/TocPanel.test.tsx`

**Interfaces:**
- Consumes: `TocItem` (`./epubToc`).
- Produces: `TocPanel` with props `{ items: TocItem[]; onNavigate: (href: string) => void }`. Renders a scrollable list of chapter buttons (indented by `level`); clicking one calls `onNavigate(href)`.

- [ ] **Step 1: Write the failing test**

Create `src/frontend/reader/TocPanel.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { TocPanel } from './TocPanel'

const items = [
  { label: 'Chapter 1', href: 'c1.xhtml', level: 0 },
  { label: 'Section 1.1', href: 'c1.xhtml#s1', level: 1 },
]

test('lists all toc entries', () => {
  render(<TocPanel items={items} onNavigate={() => {}} />)
  expect(screen.getByText('Chapter 1')).toBeInTheDocument()
  expect(screen.getByText('Section 1.1')).toBeInTheDocument()
})

test('navigates on click with the href', async () => {
  const onNavigate = vi.fn()
  render(<TocPanel items={items} onNavigate={onNavigate} />)
  await userEvent.click(screen.getByRole('button', { name: 'Section 1.1' }))
  expect(onNavigate).toHaveBeenCalledWith('c1.xhtml#s1')
})

test('shows an empty note when there are no items', () => {
  render(<TocPanel items={[]} onNavigate={() => {}} />)
  expect(screen.getByText(/no contents/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/TocPanel.test.tsx`
Expected: FAIL — `./TocPanel` not found.

- [ ] **Step 3: Implement**

Create `src/frontend/reader/TocPanel.tsx`:
```tsx
import type { TocItem } from './epubToc'

export function TocPanel({
  items, onNavigate,
}: {
  items: TocItem[]
  onNavigate: (href: string) => void
}) {
  return (
    <nav className="w-64 shrink-0 overflow-auto border-r bg-white p-2 text-sm">
      <div className="mb-2 px-2 font-semibold text-gray-500">Contents</div>
      {items.length === 0 ? (
        <p className="px-2 text-gray-400">No contents available.</p>
      ) : (
        <ul>
          {items.map((item, i) => (
            <li key={`${item.href}-${i}`}>
              <button
                type="button"
                onClick={() => onNavigate(item.href)}
                className="block w-full truncate rounded px-2 py-1 text-left hover:bg-gray-100"
                style={{ paddingLeft: `${0.5 + item.level * 0.75}rem` }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  )
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/TocPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add table-of-contents panel"
```

---

### Task 4: EpubReader container + reader settings

**Files:**
- Create: `src/frontend/reader/readerSettings.ts`, `src/frontend/reader/EpubReader.tsx`
- Test: `src/frontend/reader/readerSettings.test.ts`, `src/frontend/reader/EpubReader.test.tsx`

**Interfaces:**
- Consumes: `EpubViewer` (+ `EpubViewerHandle`, `EpubTheme`), `EpubToolbar`, `TocPanel`, `getProgress`/`saveProgress` (`@backend/data/progress`), `TocItem`.
- Produces:
  - `readerSettings.ts`: `loadReaderSettings(): { fontSize: number; theme: EpubTheme }` and `saveReaderSettings(s: { fontSize: number; theme: EpubTheme }): void` (localStorage-backed, with safe defaults `{ fontSize: 100, theme: 'light' }`).
  - `EpubReader.tsx`: `EpubReader` with props `{ bookId: string; fileUrl: string }`. Composes viewer + toolbar + toc; resumes from saved CFI; debounced-saves CFI on relocate; font/theme via settings; TOC toggle.

- [ ] **Step 1: Write the failing readerSettings test**

Create `src/frontend/reader/readerSettings.test.ts`:
```ts
import { beforeEach, expect, test } from 'vitest'
import { loadReaderSettings, saveReaderSettings } from './readerSettings'

beforeEach(() => localStorage.clear())

test('returns defaults when nothing is stored', () => {
  expect(loadReaderSettings()).toEqual({ fontSize: 100, theme: 'light' })
})

test('round-trips saved settings', () => {
  saveReaderSettings({ fontSize: 130, theme: 'dark' })
  expect(loadReaderSettings()).toEqual({ fontSize: 130, theme: 'dark' })
})

test('falls back to defaults on corrupt storage', () => {
  localStorage.setItem('reader.settings', 'not json')
  expect(loadReaderSettings()).toEqual({ fontSize: 100, theme: 'light' })
})
```

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/reader/readerSettings.test.ts`
Expected: FAIL — `./readerSettings` not found.

- [ ] **Step 3: Implement readerSettings.ts**

Create `src/frontend/reader/readerSettings.ts`:
```ts
import type { EpubTheme } from './EpubViewer'

export interface ReaderSettings {
  fontSize: number
  theme: EpubTheme
}

const KEY = 'reader.settings'
const DEFAULTS: ReaderSettings = { fontSize: 100, theme: 'light' }
const THEMES: EpubTheme[] = ['light', 'dark', 'sepia']

export function loadReaderSettings(): ReaderSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    const fontSize = typeof parsed.fontSize === 'number' ? parsed.fontSize : DEFAULTS.fontSize
    const theme = parsed.theme && THEMES.includes(parsed.theme) ? parsed.theme : DEFAULTS.theme
    return { fontSize, theme }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveReaderSettings(s: ReaderSettings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore quota errors */ }
}
```

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/reader/readerSettings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing EpubReader test (EpubViewer mocked)**

Create `src/frontend/reader/EpubReader.test.tsx`:
```tsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

// Capture the props EpubReader passes to the (mocked) EpubViewer, and expose a way
// to drive its callbacks. The mock also wires the imperative ref's next/prev.
const { viewerProps, next, prev, goTo } = vi.hoisted(() => ({
  viewerProps: { current: null as Record<string, unknown> | null },
  next: vi.fn(), prev: vi.fn(), goTo: vi.fn(),
}))
vi.mock('./EpubViewer', () => ({
  EpubViewer: (props: Record<string, unknown> & { ref?: unknown }) => {
    viewerProps.current = props
    // Assign the imperative handle to the forwarded ref.
    const ref = (props as { ref?: { current: unknown } }).ref
    if (ref && typeof ref === 'object') ref.current = { next, prev, goTo }
    return <div data-testid="epub-viewer" />
  },
}))
const { getProgress, saveProgress } = vi.hoisted(() => ({
  getProgress: vi.fn(), saveProgress: vi.fn(),
}))
vi.mock('@backend/data/progress', () => ({ getProgress, saveProgress }))

import { EpubReader } from './EpubReader'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  getProgress.mockResolvedValue(null)
  saveProgress.mockResolvedValue(undefined)
})

test('renders the viewer and passes the file url + resumed cfi', async () => {
  getProgress.mockResolvedValue('epubcfi(/6/10!/2)')
  await act(async () => {
    render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" />)
  })
  expect(screen.getByTestId('epub-viewer')).toBeInTheDocument()
  expect(viewerProps.current?.fileUrl).toBe('https://x/y.epub')
  expect(viewerProps.current?.initialCfi).toBe('epubcfi(/6/10!/2)')
})

test('Next calls the viewer handle', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" />) })
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  expect(next).toHaveBeenCalled()
})

test('larger font updates the viewer fontSize prop and persists it', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" />) })
  const before = viewerProps.current?.fontSize as number
  await userEvent.click(screen.getByRole('button', { name: /larger font/i }))
  expect((viewerProps.current?.fontSize as number)).toBeGreaterThan(before)
  expect(JSON.parse(localStorage.getItem('reader.settings')!).fontSize).toBeGreaterThan(before)
})

test('saves the cfi (debounced) when the viewer relocates', async () => {
  vi.useFakeTimers()
  try {
    await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" />) })
    act(() => { (viewerProps.current?.onRelocated as (c: string) => void)('epubcfi(/6/12!/4)') })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(saveProgress).toHaveBeenCalledWith('b1', 'epubcfi(/6/12!/4)')
  } finally {
    vi.useRealTimers()
  }
})

test('toggling contents shows the toc panel with items from the viewer', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  expect(screen.getByRole('button', { name: 'Ch 1' })).toBeInTheDocument()
})
```

- [ ] **Step 6: Run — verify it fails**

Run: `bun run test src/frontend/reader/EpubReader.test.tsx`
Expected: FAIL — `./EpubReader` not found.

- [ ] **Step 7: Implement EpubReader**

Create `src/frontend/reader/EpubReader.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { getProgress, saveProgress } from '@backend/data/progress'
import { EpubViewer, type EpubViewerHandle, type EpubTheme } from './EpubViewer'
import { EpubToolbar } from './EpubToolbar'
import { TocPanel } from './TocPanel'
import type { TocItem } from './epubToc'
import { loadReaderSettings, saveReaderSettings } from './readerSettings'

const THEMES: EpubTheme[] = ['light', 'dark', 'sepia']
const MIN_FONT = 70
const MAX_FONT = 200

export function EpubReader({ bookId, fileUrl }: { bookId: string; fileUrl: string }) {
  const viewerRef = useRef<EpubViewerHandle>(null)
  const initial = loadReaderSettings()
  const [fontSize, setFontSize] = useState(initial.fontSize)
  const [theme, setTheme] = useState<EpubTheme>(initial.theme)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(false)
  const [initialCfi, setInitialCfi] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Load the saved position before mounting the viewer, so it resumes correctly.
  useEffect(() => {
    let active = true
    getProgress(bookId).then((saved) => {
      if (!active) return
      setInitialCfi(saved)
      setReady(true)
    })
    return () => { active = false }
  }, [bookId])

  // Persist settings whenever they change.
  useEffect(() => { saveReaderSettings({ fontSize, theme }) }, [fontSize, theme])

  function onRelocated(cfi: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveProgress(bookId, cfi) }, 500)
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  const smaller = () => setFontSize((f) => Math.max(MIN_FONT, f - 10))
  const larger = () => setFontSize((f) => Math.min(MAX_FONT, f + 10))
  const cycleTheme = () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length])

  if (!ready) return <div className="p-8 text-gray-500">Loading…</div>

  return (
    <div className="flex h-full w-full flex-col">
      <EpubToolbar
        fontSize={fontSize} theme={theme}
        onPrev={() => viewerRef.current?.prev()}
        onNext={() => viewerRef.current?.next()}
        onFontSmaller={smaller} onFontLarger={larger}
        onCycleTheme={cycleTheme}
        onToggleToc={() => setTocOpen((v) => !v)}
        onBack={() => window.history.back()}
      />
      <div className="flex min-h-0 flex-1">
        {tocOpen && (
          <TocPanel
            items={toc}
            onNavigate={(href) => { viewerRef.current?.goTo(href); setTocOpen(false) }}
          />
        )}
        <div className="min-h-0 flex-1">
          <EpubViewer
            ref={viewerRef}
            fileUrl={fileUrl}
            initialCfi={initialCfi}
            fontSize={fontSize}
            theme={theme}
            onRelocated={onRelocated}
            onToc={setToc}
          />
        </div>
      </div>
    </div>
  )
}
```
Note on `onBack`: `EpubReader` uses `window.history.back()` so it doesn't need a router dependency; `ReaderPage` reached it via navigation, so Back returns to the library. (If a direct-load edge case matters later, pass an `onBack` prop from `ReaderPage`.)

- [ ] **Step 8: Run — verify it passes**

Run: `bun run test src/frontend/reader/EpubReader.test.tsx`
Expected: PASS (5 tests). If the `ref` handoff in the mock proves environment-specific (React forwardRef passes `ref` separately, not in props), adjust the mock to read the ref via `vi.mocked` of a `forwardRef` shim — but first try the provided mock; React 19 exposes `ref` as a regular prop for function components, so `props.ref` is populated.

- [ ] **Step 9: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add EpubReader container with resume, font/theme settings, and toc"
```

---

### Task 5: Wire EpubReader into ReaderPage

**Files:**
- Modify: `src/frontend/pages/ReaderPage.tsx`
- Test: `src/frontend/pages/ReaderPage.test.tsx` (update the EPUB case)

**Interfaces:**
- Consumes: `EpubReader` (`@frontend/reader/EpubReader`), plus the existing `getBookFileUrl`.
- Produces: for `book.format === 'epub'`, ReaderPage fetches the signed file URL (like the PDF branch) and renders `<EpubReader bookId={book.id} fileUrl={fileUrl} />` instead of the "not supported yet" placeholder.

- [ ] **Step 1: Update the ReaderPage test for the EPUB branch**

In `src/frontend/pages/ReaderPage.test.tsx`: add a hoisted mock for `@frontend/reader/EpubReader` (a stub div that echoes its props), e.g.:
```tsx
vi.mock('@frontend/reader/EpubReader', () => ({
  EpubReader: ({ bookId, fileUrl }: { bookId: string; fileUrl: string }) => (
    <div data-testid="epub-reader">{bookId}:{fileUrl}</div>
  ),
}))
```
Replace the existing EPUB "not supported" test with one asserting the reader mounts with the file URL:
```tsx
test('renders the EpubReader for an EPUB with its file url', async () => {
  getBook.mockResolvedValue({ id: 'b2', title: 'Novel', format: 'epub', storage_path: 'u1/b2.epub' })
  getBookFileUrl.mockResolvedValue('https://signed/b2.epub')
  renderAt('b2')
  const reader = await screen.findByTestId('epub-reader')
  expect(reader).toHaveTextContent('b2:https://signed/b2.epub')
})
```
(Keep all the PDF-branch tests unchanged.)

- [ ] **Step 2: Run — verify it fails**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: FAIL — EPUB branch still renders the placeholder, not `epub-reader`.

- [ ] **Step 3: Update ReaderPage**

In `src/frontend/pages/ReaderPage.tsx`:
- Import `EpubReader`: `import { EpubReader } from '@frontend/reader/EpubReader'`.
- In the load effect, fetch the file URL for EPUB too. Change the format guard so `getBookFileUrl` runs for both formats:
  ```tsx
  setBook(b)
  setFileUrl(await getBookFileUrl(b.storage_path))
  ```
  (previously this was gated on `b.format === 'pdf'`; now both formats need the signed URL).
- Replace the render branch. Where the EPUB placeholder was, render the reader:
  ```tsx
  {book.format === 'pdf' && fileUrl ? (
    <PdfViewer fileUrl={fileUrl} pageNumber={page} scale={scale} onNumPages={setNumPages} />
  ) : book.format === 'epub' && fileUrl ? (
    <EpubReader bookId={book.id} fileUrl={fileUrl} />
  ) : (
    <div className="p-8 text-gray-500">Loading…</div>
  )}
  ```
- The PDF toolbar (`ReaderToolbar`) should only show for PDFs — `EpubReader` renders its own `EpubToolbar`. Wrap the existing `ReaderToolbar` so it renders only when `book.format === 'pdf'`:
  ```tsx
  {book.format === 'pdf' && (
    <ReaderToolbar page={page} numPages={numPages} scale={scale}
      onPrev={prev} onNext={next} onZoomIn={zoomIn} onZoomOut={zoomOut} onBack={goBack} />
  )}
  ```
  and let the EPUB branch fill the whole area (EpubReader includes its own toolbar). Keep the outer container layout.

- [ ] **Step 4: Run — verify it passes**

Run: `bun run test src/frontend/pages/ReaderPage.test.tsx`
Expected: PASS (PDF tests + the new EPUB test).

- [ ] **Step 5: Run full suite + build**

Run: `bun run test && bun run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: render EpubReader for EPUB books in the reader page"
```

---

## Self-Review

**Spec coverage (roadmap M3):**
- Open an EPUB → Task 5 (ReaderPage EPUB branch mounts EpubReader). ✓
- Reflowable render (epub.js) → Task 1 (EpubViewer). ✓
- Font size + theme incl. dark mode → Task 2 (controls) + Task 4 (state, persistence) + Task 1 (applies to rendition). ✓
- Table of contents → Task 1 (extract) + Task 3 (panel) + Task 4 (toggle/navigate). ✓
- Progress + resume → Task 4 (resume from saved CFI, debounced save via `@backend/data/progress`). ✓
- Shared reader chrome / route reuse → Task 5 reuses `/read/:bookId` + `ReaderPage`; EPUB has its own toolbar styled to match the PDF toolbar. ✓
- Repository boundary: file URL + progress via `@backend/data/*`. ✓

**Placeholder scan:** all code steps are complete; no TBDs. The M2 "not supported yet" note is intentionally replaced in Task 5.

**Type consistency:** `EpubTheme = 'light'|'dark'|'sepia'` defined in EpubViewer and reused by EpubToolbar/readerSettings/EpubReader; `TocItem {label,href,level}` from `epubToc` used by EpubViewer/TocPanel/EpubReader; `EpubViewerHandle {next,prev,goTo}` used by EpubReader's ref; progress stored as a CFI string via the unchanged `getProgress`/`saveProgress`.

**Test isolation note:** epub.js can't render in jsdom, so `EpubViewer` mocks `epubjs` in its own test, and everything above it (`EpubReader`, `ReaderPage`) mocks `EpubViewer`. Real EPUB rendering is verified in the Milestone 3 manual check (open a real EPUB: it renders reflowably, font/theme/TOC work, reload resumes to the saved position). One thing to confirm manually: epub.js loading a Supabase signed URL cross-origin — if it fails on CORS, switch `EpubViewer` to fetch the file as an ArrayBuffer and pass that to `ePub(buffer)`.
