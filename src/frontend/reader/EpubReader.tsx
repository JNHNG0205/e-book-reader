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
