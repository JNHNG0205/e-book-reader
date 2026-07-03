import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from 'react'
import ePub, { type Rendition } from 'epubjs'
import { flattenToc, type TocItem } from './epubToc'
import { colorValue } from './highlightColors'

export type EpubTheme = 'light' | 'dark' | 'sepia'

export interface EpubViewerHandle {
  next: () => void
  prev: () => void
  goTo: (target: string) => void
  // Clears the native text selection (called once a highlight is created/cancelled, so
  // the selection stays visible while the color popover is open).
  clearSelection: () => void
}

export interface EpubViewerProps {
  fileUrl: string
  bookId?: string
  initialCfi?: string | null
  fontSize: number
  theme: EpubTheme
  onRelocated: (cfi: string) => void
  onToc: (toc: TocItem[]) => void
  onProgress?: (p: { current: number; total: number }) => void
  // Current section href on each relocation — used to keep the TOC highlight in sync
  // with the actual reading position (in-book links, page turns), not just sidebar clicks.
  onSection?: (href: string) => void
  // Currently-saved highlights to render as epub.js annotations.
  highlights?: Array<{ id: string; cfiRange: string; color: string }>
  // Fired when the user selects text in the rendered book.
  onSelect?: (sel: { cfiRange: string; text: string; x: number; y: number }) => void
  // Fired on a new click/tap inside the book, so the reader can dismiss an open popover.
  onDismiss?: () => void
  // Fired when a rendered highlight annotation is clicked.
  onHighlightClick?: (id: string, x: number, y: number) => void
}

// Generating epub.js "locations" (the index behind the "X / Y" progress count) is slow
// on first open — a few seconds for a full book. We persist the generated index per book
// so every later open loads it instantly instead of recomputing.
// Size each epub.js "location" to roughly one on-screen page of text, so page numbers
// advance by ~1 per turn. (Reflowable text has no true fixed pages, so the count is
// approximate and shifts a little with font size.)
const LOCATION_CHARS = 3000

function locationsCacheKey(bookId: string): string {
  // Include the granularity so changing LOCATION_CHARS invalidates stale caches.
  return `epub.locations.${LOCATION_CHARS}.${bookId}`
}
function readLocationsCache(bookId: string): string | null {
  try { return localStorage.getItem(locationsCacheKey(bookId)) } catch { return null }
}
function writeLocationsCache(bookId: string, json: string): void {
  try { localStorage.setItem(locationsCacheKey(bookId), json) } catch { /* ignore quota */ }
}

const THEME_STYLES: Record<EpubTheme, Record<string, Record<string, string>>> = {
  light: { body: { background: '#ffffff', color: '#111111' } },
  dark: { body: { background: '#111111', color: '#e5e5e5' } },
  sepia: { body: { background: '#f4ecd8', color: '#5b4636' } },
}

// epub.js's registerRules/select theme path injects empty CSS for some books (the
// background never changes). `themes.override` instead sets the property directly on
// each rendered section's <body> with !important, applies immediately to current
// sections, and re-applies to new ones — so theme switches actually change the page.
function applyEpubTheme(rendition: Rendition, theme: EpubTheme): void {
  const body = THEME_STYLES[theme].body
  const themes = rendition.themes as unknown as {
    override: (name: string, value: string, priority?: boolean) => void
  }
  themes.override('color', body.color, true)
  themes.override('background', body.background, true)
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'

// epub.js substitutes most in-archive resource URLs (e.g. stylesheet <link>s become
// blob: URLs), but for some calibre-generated books it leaves plain
// <img src="images/00013.jpg"> as a relative path, which then resolves against the
// section's http(s) <base> and 404s (broken image). This per-section hook repairs those:
// it matches each image to its manifest entry (by filename) and swaps in the blob URL
// epub.js already created for that resource via `resources.get` — reusing epub.js's own
// resolution rather than guessing archive paths.
// Any image we can't resolve (or that later fails to load) is replaced with a small
// centered divider bar rather than the browser's broken-image icon — most of these are
// decorative section-break ornaments, so a divider reads as intentional. `currentColor`
// keeps it visible across the light/dark/sepia themes.
function makeDivider(doc: Document): HTMLElement {
  const div = doc.createElement('div')
  div.setAttribute('data-broken-image', 'true')
  div.style.cssText =
    'width:48px;height:4px;margin:1.5em auto;background:currentColor;opacity:0.55;border-radius:2px;'
  return div
}

function replaceWithDivider(el: Element): void {
  // For an SVG <image>, swap out the whole <svg> wrapper (a bare div inside SVG won't render).
  const target = el.tagName.toLowerCase() === 'image' ? el.closest('svg') ?? el : el
  const doc = target.ownerDocument
  if (!doc || !target.parentNode) return
  target.replaceWith(makeDivider(doc))
}

async function fixArchivedImages(book: ReturnType<typeof ePub>, doc: Document): Promise<void> {
  const resources = book.resources as unknown as {
    urls?: string[]
    get?: (href: string) => Promise<string>
  } | undefined
  const urls = resources?.urls
  const get = resources?.get?.bind(resources)

  const basename = (p: string): string => p.split(/[?#]/)[0].split('/').pop() ?? p

  const images: Array<{ el: Element; isSvg: boolean }> = []
  doc.querySelectorAll('img[src]').forEach((el) => images.push({ el, isSvg: false }))
  doc.querySelectorAll('image').forEach((el) => images.push({ el, isSvg: true }))

  for (const { el, isSvg } of images) {
    try {
      const current = isSvg
        ? el.getAttributeNS(XLINK_NS, 'href') || el.getAttribute('href')
        : el.getAttribute('src')
      if (!current) continue

      // Already resolved to an inline/blob URL — just guard against a failed load.
      if (current.startsWith('blob:') || current.startsWith('data:')) {
        if (!isSvg) el.addEventListener('error', () => replaceWithDivider(el), { once: true })
        continue
      }

      // Try to resolve against the archive manifest by filename.
      let blobUrl: string | null = null
      if (urls && get) {
        const wanted = basename(current)
        const href = urls.find((u) => basename(u) === wanted)
        if (href) blobUrl = await get(href)
      }

      if (blobUrl) {
        if (isSvg) {
          el.setAttribute('href', blobUrl)
          el.setAttributeNS(XLINK_NS, 'xlink:href', blobUrl)
        } else {
          el.setAttribute('src', blobUrl)
          el.addEventListener('error', () => replaceWithDivider(el), { once: true })
        }
      } else {
        // Couldn't resolve → show a divider instead of a broken-image icon.
        replaceWithDivider(el)
      }
    } catch {
      replaceWithDivider(el)
    }
  }
}

// epub.js's published types claim `locationFromCfi` returns a `Location` object, but at
// runtime it returns a 0-based location index (number). We report it as a 1-based
// "page" number so it reads naturally as "current / total".
// A TOC href sometimes doesn't match the spine's stored href (path-prefix differences),
// so epub.js's spine.get() returns null and display() silently no-ops — the clicked
// entry does nothing. When the exact href doesn't resolve, fall back to the spine item
// with the same filename so the entry still navigates (to that chapter).
function resolveTocTarget(book: ReturnType<typeof ePub> | null, href: string): string {
  if (!book) return href
  try {
    const spine = book.spine as unknown as {
      get: (t: string) => unknown
      each: (cb: (item: { href?: string }) => void) => void
    }
    if (spine.get(href)) return href
    const wanted = href.split('#')[0].split('/').pop()
    let match: string | null = null
    spine.each((item) => {
      if (!match && item.href && item.href.split('/').pop() === wanted) match = item.href
    })
    return match ?? href
  } catch {
    return href
  }
}

// With screen-sized locations (LOCATION_CHARS), the location index reads as a page
// number: current = index + 1, total = number of locations.
function reportProgressForCfi(
  book: ReturnType<typeof ePub>,
  cfi: string,
  onProgressRef: { current?: (p: { current: number; total: number }) => void },
) {
  if (!onProgressRef.current) return
  const total = book.locations.length()
  if (!total) return
  const index = book.locations.locationFromCfi(cfi) as unknown as number
  if (typeof index !== 'number' || Number.isNaN(index)) return
  onProgressRef.current({ current: index + 1, total })
}

// Reads the selection rect from the iframe's own document and offsets it by the
// iframe's position in the outer page, so the resulting (x, y) is a viewport coordinate
// usable to position a popover in the host document.
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

interface SelectionWindow {
  getSelection: () => {
    rangeCount: number
    toString: () => string
    getRangeAt: (i: number) => { collapsed?: boolean; getBoundingClientRect: () => DOMRect }
    removeAllRanges: () => void
  } | null
  frameElement?: { getBoundingClientRect: () => { left: number; top: number } } | null
}

// The `contents` epub.js passes to a content hook — its `window`/`cfiFromRange` are only
// present for real rendered sections (jsdom-only test docs omit them).
interface HookContents {
  document: Document
  window?: SelectionWindow
  cfiFromRange?: (range: unknown) => string
}

// epub.js's own `selected` event is debounced ~250ms, so the popover lagged behind the
// cursor. Instead we listen for mouseup/touchend on each section document and, if there's
// a non-empty selection, compute its CFI + position immediately — so the color popover
// appears the moment you release the cursor.
function attachSelectionHandler(
  contents: HookContents,
  onSelectRef: { current?: (s: { cfiRange: string; text: string; x: number; y: number }) => void },
  onDismissRef: { current?: (() => void) | undefined },
  selectionWindowRef: { current: SelectionWindow | null },
): void {
  const win = contents.window
  // Bind to `contents` — epub.js's cfiFromRange uses `this.cfiBase`, so an unbound call throws.
  const cfiFromRange = contents.cfiFromRange?.bind(contents)
  if (!win || !cfiFromRange) return
  const handler = (): void => {
    const sel = win.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) return
    const text = sel.toString().trim()
    if (!text) return
    let cfiRange: string
    try { cfiRange = cfiFromRange(range) } catch { return }
    const { x, y } = selectionPosition({ window: win })
    selectionWindowRef.current = win
    onSelectRef.current?.({ cfiRange, text, x, y })
  }
  // Any new click/tap inside the book dismisses an open popover. A subsequent mouseup
  // that produced a selection re-opens it; a click that produced none leaves it closed
  // (so cancelling a selection closes the palette). Parent-document outside-clicks are
  // handled separately by the popover itself.
  const dismiss = (): void => onDismissRef.current?.()
  contents.document.addEventListener('mousedown', dismiss)
  contents.document.addEventListener('touchstart', dismiss)
  contents.document.addEventListener('mouseup', handler)
  contents.document.addEventListener('touchend', handler)
}

// Diffs `highlights` against the ids already applied as epub.js annotations, removing
// ones that were deleted or recolored and adding new/changed ones — so re-renders don't
// blindly re-add every highlight (which would leak duplicate marks in the iframe).
interface AppliedAnnotation { cfiRange: string; color: string }

function syncAnnotations(
  rendition: Rendition,
  highlights: Array<{ id: string; cfiRange: string; color: string }>,
  applied: Map<string, AppliedAnnotation>,
  onHighlightClick: { current?: ((id: string, x: number, y: number) => void) | undefined },
): void {
  const annotations = rendition.annotations as unknown as {
    add: (
      type: string, cfiRange: string, data: unknown,
      cb: (e?: { target?: { getBoundingClientRect?: () => DOMRect } }) => void,
      className: string, styles: Record<string, string>,
    ) => void
    remove: (cfiRange: string, type: string) => void
  }
  const next = new Set(highlights.map((h) => h.id))
  // remove annotations for highlights that are gone
  for (const [id, prev] of applied) {
    if (!next.has(id)) { annotations.remove(prev.cfiRange, 'highlight'); applied.delete(id) }
  }
  // add new ones, or re-add ones whose cfiRange OR color changed
  for (const h of highlights) {
    const prev = applied.get(h.id)
    if (prev && prev.cfiRange === h.cfiRange && prev.color === h.color) continue
    if (prev) annotations.remove(prev.cfiRange, 'highlight')
    annotations.add(
      'highlight', h.cfiRange, { id: h.id },
      // marks-pane dispatches a CLONED event whose clientX/clientY are lost (0), so we
      // position the edit popover from the clicked mark element's own rectangle instead.
      (e) => {
        const rect = e?.target?.getBoundingClientRect?.()
        const x = rect ? rect.left + rect.width / 2 : 0
        const y = rect ? rect.top : 0
        onHighlightClick.current?.(h.id, x, y)
      },
      `hl-${h.id}`, { fill: colorValue(h.color), 'fill-opacity': '0.35', 'mix-blend-mode': 'multiply' },
    )
    applied.set(h.id, { cfiRange: h.cfiRange, color: h.color })
  }
}

export const EpubViewer = forwardRef<EpubViewerHandle, EpubViewerProps>(function EpubViewer(
  {
    fileUrl, bookId, initialCfi, fontSize, theme, onRelocated, onToc, onProgress, onSection,
    highlights, onSelect, onHighlightClick, onDismiss,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renditionRef = useRef<Rendition | null>(null)
  const bookRef = useRef<ReturnType<typeof ePub> | null>(null)
  const onRelocatedRef = useRef(onRelocated)
  const onTocRef = useRef(onToc)
  const onProgressRef = useRef(onProgress)
  const onSectionRef = useRef(onSection)
  const onSelectRef = useRef(onSelect)
  const onDismissRef = useRef(onDismiss)
  // The window of the section where text was last selected, so clearSelection() can
  // clear it after the color popover is dismissed.
  const selectionWindowRef = useRef<SelectionWindow | null>(null)
  const onHighlightClickRef = useRef(onHighlightClick)
  const appliedRef = useRef(new Map<string, AppliedAnnotation>())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { onRelocatedRef.current = onRelocated }, [onRelocated])
  useEffect(() => { onTocRef.current = onToc }, [onToc])
  useEffect(() => { onProgressRef.current = onProgress }, [onProgress])
  useEffect(() => { onSectionRef.current = onSection }, [onSection])
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onDismissRef.current = onDismiss }, [onDismiss])
  useEffect(() => { onHighlightClickRef.current = onHighlightClick }, [onHighlightClick])

  useImperativeHandle(ref, () => ({
    next: () => renditionRef.current?.next(),
    prev: () => renditionRef.current?.prev(),
    goTo: (target: string) => {
      const r = renditionRef.current
      if (!r) return
      void r.display(resolveTocTarget(bookRef.current, target)).catch(() => { /* target unresolved */ })
    },
    clearSelection: () => { selectionWindowRef.current?.getSelection()?.removeAllRanges() },
  }), [])

  // Create the book + rendition once per file.
  useEffect(() => {
    let cancelled = false
    let book: ReturnType<typeof ePub> | null = null
    setError(null)

    void (async () => {
      try {
        const res = await fetch(fileUrl)
        if (!res.ok) {
          setError('Failed to load this book.')
          return
        }
        const buffer = await res.arrayBuffer()
        if (cancelled || !containerRef.current) return

        book = ePub(buffer)
        const rendition = book.renderTo(containerRef.current, {
          width: '100%', height: '100%', flow: 'paginated', spread: 'none',
        })
        renditionRef.current = rendition
        bookRef.current = book
        applyEpubTheme(rendition, theme)
        rendition.themes.fontSize(`${fontSize}%`)
        const currentBook = book
        // Repair archived <img> references epub.js leaves unresolved. Registered before
        // display() so it also runs for the first rendered section.
        rendition.hooks.content.register((contents: HookContents) => {
          void fixArchivedImages(currentBook, contents.document)
          // Fire the color popover on mouseup (instant), not epub.js's debounced
          // `selected`. The native selection stays visible until the popover is dismissed.
          attachSelectionHandler(contents, onSelectRef, onDismissRef, selectionWindowRef)
        })
        void rendition.display(initialCfi ?? undefined)
        rendition.on('relocated', (loc: { start: { cfi: string; href?: string } }) => {
          onRelocatedRef.current(loc.start.cfi)
          reportProgressForCfi(currentBook, loc.start.cfi, onProgressRef)
          if (loc.start.href) onSectionRef.current?.(loc.start.href)
        })
        appliedRef.current = new Map<string, AppliedAnnotation>()
        syncAnnotations(rendition, highlights ?? [], appliedRef.current, onHighlightClickRef)
        void book.loaded.navigation
          .then((nav: { toc: Parameters<typeof flattenToc>[0] }) => { onTocRef.current(flattenToc(nav.toc)) })
          .catch(() => { /* navigation failed to load; leave toc empty */ })

        // Generate locations (an even, page-like pagination index) so we can report
        // reading progress as "current / total". This can be slow/unsupported for
        // some books, so failures are swallowed and progress is simply not reported.
        try {
          await book.ready
          const locations = book.locations as unknown as {
            generate: (chars: number) => Promise<unknown>
            load: (json: string) => void
            save: () => string
          }
          const cached = bookId ? readLocationsCache(bookId) : null
          if (cached) {
            locations.load(cached) // instant on re-open
          } else {
            await locations.generate(LOCATION_CHARS)
            if (bookId) writeLocationsCache(bookId, locations.save())
          }
          if (cancelled) return
          const loc = rendition.currentLocation() as unknown as { start: { cfi: string } } | undefined
          if (loc?.start?.cfi) reportProgressForCfi(book, loc.start.cfi, onProgressRef)
        } catch {
          // Locations unavailable; skip progress reporting.
        }
      } catch {
        setError('Failed to load this book.')
      }
    })()

    return () => { cancelled = true; book?.destroy() }
    // Intentionally only re-create when the file changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  // Apply font size when it changes.
  useEffect(() => { renditionRef.current?.themes.fontSize(`${fontSize}%`) }, [fontSize])
  // Apply theme when it changes.
  useEffect(() => {
    const r = renditionRef.current
    if (r) applyEpubTheme(r, theme)
  }, [theme])
  // Re-sync annotations whenever the saved highlights change.
  useEffect(() => {
    const r = renditionRef.current
    if (r) syncAnnotations(r, highlights ?? [], appliedRef.current, onHighlightClickRef)
  }, [highlights])

  if (error) {
    return <div className="p-8 text-red-600" role="alert">{error}</div>
  }

  return <div ref={containerRef} className="h-full w-full" data-testid="epub-container" />
})
