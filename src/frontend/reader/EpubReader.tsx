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
        current={progress?.current ?? 0} total={progress?.total ?? 0}
        onPrev={() => viewerRef.current?.prev()}
        onNext={() => viewerRef.current?.next()}
        onFontSmaller={smaller} onFontLarger={larger}
        onCycleTheme={cycleTheme}
        onToggleToc={() => setTocOpen((v) => !v)}
        onBack={onBack}
      />
      <div className={`flex min-h-0 flex-1 justify-center ${AREA_BG[theme]}`}>
        {tocOpen && (
          <TocPanel
            items={toc}
            activeHref={activeHref}
            onNavigate={(href) => { viewerRef.current?.goTo(href); setActiveHref(href) }}
            onClose={() => setTocOpen(false)}
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
          />
        </div>
      </div>
    </div>
  )
}
