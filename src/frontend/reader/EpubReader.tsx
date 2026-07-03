import { useEffect, useMemo, useRef, useState } from 'react'
import { getProgress, saveProgress } from '@backend/data/progress'
import { listBookmarks, saveBookmark, deleteBookmark } from '@backend/data/bookmarks'
import { listHighlights, saveHighlight, updateHighlight, deleteHighlight } from '@backend/data/highlights'
import { EpubViewer, type EpubViewerHandle, type EpubTheme } from './EpubViewer'
import { EpubToolbar } from './EpubToolbar'
import { TocPanel } from './TocPanel'
import { ReaderSidebar } from './ReaderSidebar'
import { BookmarksPanel } from './BookmarksPanel'
import { HighlightsPanel } from './HighlightsPanel'
import { HighlightPopover } from './HighlightPopover'
import { BookmarkStar } from './BookmarkStar'
import type { TocItem } from './epubToc'
import type { Bookmark, Highlight } from '@shared/types'
import { loadReaderSettings, saveReaderSettings } from './readerSettings'

const THEMES: EpubTheme[] = ['light', 'dark', 'sepia']
const MIN_FONT = 70
const MAX_FONT = 200

// Background for the area around the reading column, matched to the theme so the
// letterbox on wide screens blends with the page instead of showing a bright frame.
const AREA_BG: Record<EpubTheme, string> = {
  light: 'bg-gray-100',
  dark: 'bg-neutral-900',
  sepia: 'bg-[#efe6d2]',
}

export function EpubReader({ bookId, fileUrl, onBack }: { bookId: string; fileUrl: string; onBack: () => void }) {
  const viewerRef = useRef<EpubViewerHandle>(null)
  const initial = loadReaderSettings()
  const [fontSize, setFontSize] = useState(initial.fontSize)
  const [theme, setTheme] = useState<EpubTheme>(initial.theme)
  const [toc, setToc] = useState<TocItem[]>([])
  const [tocOpen, setTocOpen] = useState(false)
  const [activeHref, setActiveHref] = useState<string | null>(null)
  const [initialCfi, setInitialCfi] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [currentCfi, setCurrentCfi] = useState<string | null>(null)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [popover, setPopover] = useState<null | {
    mode: 'create' | 'edit'; x: number; y: number; cfiRange?: string; text?: string
    id?: string; color?: string; note?: string | null
  }>(null)

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

  // Load bookmarks on mount.
  useEffect(() => { listBookmarks(bookId).then(setBookmarks).catch(() => {}) }, [bookId])

  // Load highlights on mount.
  useEffect(() => { listHighlights(bookId).then(setHighlights).catch(() => {}) }, [bookId])

  // Stable across unrelated re-renders (relocate/progress) so EpubViewer's highlight
  // sync effect only re-runs when the highlights actually change.
  const viewerHighlights = useMemo(
    () => highlights.map((h) => ({
      id: h.id,
      cfiRange: String((h.anchor as { cfiRange?: string }).cfiRange ?? ''),
      color: h.color,
    })),
    [highlights],
  )

  // Close the popover and clear the (still-visible) text selection.
  function closePopover() {
    viewerRef.current?.clearSelection()
    setPopover(null)
  }

  async function createHighlight(color: string) {
    if (!popover?.cfiRange) return
    const saved = await saveHighlight(bookId, { color, anchor: { cfiRange: popover.cfiRange, text: popover.text ?? '' } })
    setHighlights((prev) => [...prev, saved])
    closePopover()
  }
  async function changeColor(color: string) {
    if (!popover?.id) return
    await updateHighlight(popover.id, { color })
    setHighlights((prev) => prev.map((h) => (h.id === popover.id ? { ...h, color } : h)))
    closePopover()
  }
  async function saveNote(note: string) {
    if (!popover?.id) return
    await updateHighlight(popover.id, { note })
    setHighlights((prev) => prev.map((h) => (h.id === popover.id ? { ...h, note } : h)))
    closePopover()
  }
  async function removeHighlight(id: string) {
    await deleteHighlight(id)
    setHighlights((prev) => prev.filter((h) => h.id !== id))
    closePopover()
  }

  function onRelocated(cfi: string) {
    setCurrentCfi(cfi)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveProgress(bookId, cfi) }, 500)
  }
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current) }, [])

  // Keep the sidebar TOC highlight in sync with the actual reading position (page
  // turns, in-book links) by matching the current section's file to a TOC entry.
  function handleSection(sectionHref: string) {
    const base = sectionHref.split('#')[0].split('/').pop()
    if (!base) return
    const matched = toc.find((t) => t.href.split('#')[0].split('/').pop() === base)
    if (matched) setActiveHref(matched.href)
  }

  // Fall back to the resume position if the reader hasn't emitted a relocation yet
  // (e.g. tapping the bookmark button immediately after opening).
  const activeLocation = currentCfi ?? initialCfi
  const isBookmarked = activeLocation != null && bookmarks.some((b) => b.location === activeLocation)

  async function toggleBookmark() {
    if (!activeLocation) return
    const existing = bookmarks.find((b) => b.location === activeLocation)
    if (existing) {
      await deleteBookmark(existing.id)
      setBookmarks((prev) => prev.filter((b) => b.id !== existing.id))
    } else {
      const label = progress ? `Page ${progress.current}` : 'Bookmark'
      const bm = await saveBookmark(bookId, { location: activeLocation, label })
      setBookmarks((prev) => [...prev, bm])
    }
  }
  async function removeBookmark(id: string) {
    await deleteBookmark(id)
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }

  const smaller = () => setFontSize((f) => Math.max(MIN_FONT, f - 10))
  const larger = () => setFontSize((f) => Math.min(MAX_FONT, f + 10))
  const cycleTheme = () => setTheme((t) => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length])

  if (!ready) return <div className="p-8 text-gray-500">Loading…</div>

  return (
    <div className="flex h-full w-full flex-col">
      <EpubToolbar
        fontSize={fontSize} theme={theme}
        current={progress?.current ?? 0} total={progress?.total ?? 0}
        onPrev={() => viewerRef.current?.prev()}
        onNext={() => viewerRef.current?.next()}
        onFontSmaller={smaller} onFontLarger={larger}
        onCycleTheme={cycleTheme}
        onToggleToc={() => setTocOpen((v) => !v)}
        onBack={onBack}
      />
      <div className={`relative flex min-h-0 flex-1 justify-center ${AREA_BG[theme]}`}>
        <div className="absolute right-3 top-3 z-10">
          <BookmarkStar active={isBookmarked} onToggle={() => { void toggleBookmark() }} />
        </div>
        {tocOpen && (
          <ReaderSidebar
            onClose={() => setTocOpen(false)}
            tabs={[
              { key: 'contents', label: 'Contents', render: () => (
                <TocPanel
                  items={toc}
                  activeHref={activeHref}
                  onNavigate={(href) => { viewerRef.current?.goTo(href); setActiveHref(href) }}
                />
              ) },
              { key: 'bookmarks', label: 'Bookmarks', render: () => (
                <BookmarksPanel
                  bookmarks={bookmarks}
                  onJump={(loc) => viewerRef.current?.goTo(loc)}
                  onDelete={removeBookmark}
                />
              ) },
              { key: 'highlights', label: 'Highlights', render: () => (
                <HighlightsPanel
                  highlights={highlights}
                  onJump={(h) => viewerRef.current?.goTo(String((h.anchor as { cfiRange?: string }).cfiRange ?? ''))}
                  onDelete={removeHighlight}
                />
              ) },
            ]}
          />
        )}
        {/* Constrain the reading column to a book-like width so lines don't stretch
            across a wide desktop; epub.js paginates to this container's width. */}
        <div className="min-h-0 w-full max-w-2xl">
          <EpubViewer
            ref={viewerRef}
            fileUrl={fileUrl}
            bookId={bookId}
            initialCfi={initialCfi}
            fontSize={fontSize}
            theme={theme}
            onRelocated={onRelocated}
            onToc={setToc}
            onProgress={setProgress}
            onSection={handleSection}
            onDismiss={() => setPopover(null)}
            highlights={viewerHighlights}
            onSelect={(s) => setPopover({ mode: 'create', x: s.x, y: s.y, cfiRange: s.cfiRange, text: s.text })}
            onHighlightClick={(id, x, y) => {
              const h = highlights.find((v) => v.id === id)
              if (h) setPopover({ mode: 'edit', x, y, id, color: h.color, note: h.note })
            }}
          />
        </div>
        {popover && (
          <HighlightPopover
            key={popover.id ?? 'create'}
            x={popover.x} y={popover.y} mode={popover.mode}
            color={popover.color} note={popover.note}
            onPickColor={(c) => { void (popover.mode === 'create' ? createHighlight(c) : changeColor(c)) }}
            onSaveNote={(n) => { void saveNote(n) }}
            onDelete={() => { if (popover.id) void removeHighlight(popover.id) }}
            onClose={closePopover}
          />
        )}
      </div>
    </div>
  )
}
