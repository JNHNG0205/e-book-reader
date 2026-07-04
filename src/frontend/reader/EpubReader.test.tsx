import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

// Capture the props EpubReader passes to the (mocked) EpubViewer, and expose a way
// to drive its callbacks. The mock also wires the imperative ref's next/prev.
const { viewerProps, next, prev, goTo, clearSelection, search } = vi.hoisted(() => ({
  viewerProps: { current: null as Record<string, unknown> | null },
  next: vi.fn(), prev: vi.fn(), goTo: vi.fn(), clearSelection: vi.fn(), search: vi.fn(),
}))
vi.mock('./EpubViewer', () => ({
  EpubViewer: (props: Record<string, unknown> & { ref?: unknown }) => {
    viewerProps.current = props
    // Assign the imperative handle to the forwarded ref.
    const ref = (props as { ref?: { current: unknown } }).ref
    if (ref && typeof ref === 'object') ref.current = { next, prev, goTo, clearSelection, search }
    return <div data-testid="epub-viewer" />
  },
}))
const { getProgress, saveProgress, listBookmarks, saveBookmark, deleteBookmark,
  listHighlights, saveHighlight, updateHighlight, deleteHighlight } = vi.hoisted(() => ({
  getProgress: vi.fn(), saveProgress: vi.fn(),
  listBookmarks: vi.fn(), saveBookmark: vi.fn(), deleteBookmark: vi.fn(),
  listHighlights: vi.fn(), saveHighlight: vi.fn(), updateHighlight: vi.fn(), deleteHighlight: vi.fn(),
}))
vi.mock('@frontend/offline/offlineData', () => ({
  getProgress, saveProgress, listBookmarks, saveBookmark, deleteBookmark,
  listHighlights, saveHighlight, updateHighlight, deleteHighlight,
}))

import { EpubReader } from './EpubReader'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  getProgress.mockResolvedValue(null)
  saveProgress.mockResolvedValue(undefined)
  listBookmarks.mockResolvedValue([])
  saveBookmark.mockResolvedValue({ id: 'bm1' })
  deleteBookmark.mockResolvedValue(undefined)
  listHighlights.mockResolvedValue([])
  saveHighlight.mockResolvedValue(undefined)
  updateHighlight.mockResolvedValue(undefined)
  deleteHighlight.mockResolvedValue(undefined)
  search.mockResolvedValue([])
})

test('renders the viewer and passes the file url + resumed cfi', async () => {
  getProgress.mockResolvedValue('epubcfi(/6/10!/2)')
  await act(async () => {
    render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />)
  })
  expect(screen.getByTestId('epub-viewer')).toBeInTheDocument()
  expect(viewerProps.current?.fileUrl).toBe('https://x/y.epub')
  expect(viewerProps.current?.initialCfi).toBe('epubcfi(/6/10!/2)')
})

test('Next calls the viewer handle', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  await userEvent.click(screen.getByRole('button', { name: /next/i }))
  expect(next).toHaveBeenCalled()
})

test('larger font updates the viewer fontSize prop and persists it', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  const before = viewerProps.current?.fontSize as number
  await userEvent.click(screen.getByRole('button', { name: /larger font/i }))
  expect((viewerProps.current?.fontSize as number)).toBeGreaterThan(before)
  expect(JSON.parse(localStorage.getItem('reader.settings')!).fontSize).toBeGreaterThan(before)
})

test('saves the cfi (debounced) when the viewer relocates', async () => {
  vi.useFakeTimers()
  try {
    await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
    act(() => { (viewerProps.current?.onProgress as (p: { current: number; total: number }) => void)({ current: 3, total: 10 }) })
    act(() => { (viewerProps.current?.onRelocated as (c: string) => void)('epubcfi(/6/12!/4)') })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(saveProgress).toHaveBeenCalledWith('b1', 'epubcfi(/6/12!/4)', 30) // 3 of 10
  } finally {
    vi.useRealTimers()
  }
})

test('toggling contents shows the toc panel with items from the viewer', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  expect(screen.getByRole('button', { name: 'Ch 1' })).toBeInTheDocument()
})

test('clicking a toc item navigates but keeps the panel open', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Ch 1' }))
  expect(goTo).toHaveBeenCalledWith('c1.xhtml')
  expect(screen.getByRole('button', { name: 'Ch 1' })).toBeInTheDocument()
})

test('toggling contents again closes the panel', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  await userEvent.click(screen.getByRole('button', { name: /close panel/i }))
  expect(screen.queryByRole('button', { name: 'Ch 1' })).not.toBeInTheDocument()
})

test('Back button calls the provided onBack', async () => {
  const onBack = vi.fn()
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={onBack} />) })
  await userEvent.click(screen.getByRole('button', { name: /library/i }))
  expect(onBack).toHaveBeenCalled()
})

test('adds a bookmark at the current cfi via the star toggle', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  // simulate a relocation so there is a current cfi
  act(() => { (viewerProps.current?.onRelocated as (c: string) => void)('epubcfi(/6/14!/2)') })
  await userEvent.click(screen.getByRole('button', { name: 'Add bookmark' }))
  await waitFor(() => expect(saveBookmark).toHaveBeenCalledWith('b1', expect.objectContaining({ location: 'epubcfi(/6/14!/2)' })))
})

test('shows a filled star and removes the bookmark when the current cfi is already bookmarked', async () => {
  listBookmarks.mockResolvedValue([
    { id: 'bm1', user_id: 'u1', book_id: 'b1', location: 'epubcfi(/6/14!/2)', label: 'Bookmark', created_at: '', updated_at: '' },
  ])
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  act(() => { (viewerProps.current?.onRelocated as (c: string) => void)('epubcfi(/6/14!/2)') })
  await userEvent.click(screen.getByRole('button', { name: 'Remove bookmark' }))
  await waitFor(() => expect(deleteBookmark).toHaveBeenCalledWith('b1', 'bm1'))
})

test('shows bookmarks in the sidebar and jumps via goTo', async () => {
  listBookmarks.mockResolvedValue([
    { id: 'bm1', user_id: 'u1', book_id: 'b1', location: 'epubcfi(/6/20!/4)', label: 'Loc 42', created_at: '', updated_at: '' },
  ])
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Bookmarks' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Loc 42' }))
  expect(goTo).toHaveBeenCalledWith('epubcfi(/6/20!/4)')
})

test('creates a highlight from a selection', async () => {
  saveHighlight.mockResolvedValue({ id: 'h1', color: 'yellow', anchor: { cfiRange: 'epubcfi(sel)', text: 'hi' }, note: null, user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' })
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  act(() => { (viewerProps.current?.onSelect as (s: unknown) => void)({ cfiRange: 'epubcfi(sel)', text: 'hi', x: 20, y: 20 }) })
  await userEvent.click(await screen.findByRole('button', { name: /yellow/i }))
  await waitFor(() => expect(saveHighlight).toHaveBeenCalledWith('b1', expect.objectContaining({
    color: 'yellow', anchor: expect.objectContaining({ cfiRange: 'epubcfi(sel)', text: 'hi' }),
  })))
})

test('creating a highlight while offline still shows up in the UI (facade resolves from the local cache/outbox)', async () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
  try {
    // Mirrors what the real offlineData facade does offline: saveHighlight writes to the
    // local cache + outbox and resolves the row immediately, without reaching the network.
    saveHighlight.mockResolvedValue({
      id: 'h-offline', color: 'blue', anchor: { cfiRange: 'epubcfi(off)', text: 'offline text' },
      note: null, user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '',
    })
    await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
    act(() => { (viewerProps.current?.onSelect as (s: unknown) => void)({ cfiRange: 'epubcfi(off)', text: 'offline text', x: 20, y: 20 }) })
    await userEvent.click(await screen.findByRole('button', { name: /blue/i }))
    await waitFor(() => expect(saveHighlight).toHaveBeenCalledWith('b1', expect.objectContaining({ color: 'blue' })))
    await userEvent.click(screen.getByRole('button', { name: /menu/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Highlights' }))
    expect(await screen.findByText(/offline text/)).toBeInTheDocument()
  } finally {
    if (originalOnLine) Object.defineProperty(window.navigator, 'onLine', originalOnLine)
  }
})

test('shows highlights in the Highlights tab and jumps', async () => {
  listHighlights.mockResolvedValue([
    { id: 'h1', color: 'green', note: null, anchor: { cfiRange: 'epubcfi(hl1)', text: 'saved bit' }, user_id: 'u1', book_id: 'b1', created_at: '', updated_at: '' },
  ])
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  await userEvent.click(await screen.findByRole('button', { name: 'Highlights' }))
  await userEvent.click(await screen.findByText(/saved bit/))
  expect(goTo).toHaveBeenCalledWith('epubcfi(hl1)')
})

test('searches the book from the Search tab and jumps to a result', async () => {
  search.mockResolvedValue([
    { id: 'epubcfi(/6/2!/2)', location: 'epubcfi(/6/2!/2)', excerpt: 'a whale swam by' },
  ])
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={() => {}} />) })
  await userEvent.click(screen.getByRole('button', { name: /menu/i }))
  // "Search" labels both the sidebar tab button and (once active) the panel's submit
  // button — the tab is the first "Search"-named button in DOM order.
  const [searchTab] = await screen.findAllByRole('button', { name: 'Search' })
  await userEvent.click(searchTab)
  await userEvent.type(screen.getByPlaceholderText(/search this book/i), 'whale')
  const searchButtons = screen.getAllByRole('button', { name: 'Search' })
  await userEvent.click(searchButtons[searchButtons.length - 1])
  expect(search).toHaveBeenCalledWith('whale')
  await userEvent.click(await screen.findByText(/a whale swam by/))
  expect(goTo).toHaveBeenCalledWith('epubcfi(/6/2!/2)')
})
