import { render, screen, act, waitFor } from '@testing-library/react'
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
const { listBookmarks, saveBookmark, deleteBookmark } = vi.hoisted(() => ({
  listBookmarks: vi.fn(), saveBookmark: vi.fn(), deleteBookmark: vi.fn(),
}))
vi.mock('@backend/data/bookmarks', () => ({ listBookmarks, saveBookmark, deleteBookmark }))

import { EpubReader } from './EpubReader'

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  getProgress.mockResolvedValue(null)
  saveProgress.mockResolvedValue(undefined)
  listBookmarks.mockResolvedValue([])
  saveBookmark.mockResolvedValue({ id: 'bm1' })
  deleteBookmark.mockResolvedValue(undefined)
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
    act(() => { (viewerProps.current?.onRelocated as (c: string) => void)('epubcfi(/6/12!/4)') })
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(saveProgress).toHaveBeenCalledWith('b1', 'epubcfi(/6/12!/4)')
  } finally {
    vi.useRealTimers()
  }
})

test('toggling contents shows the toc panel with items from the viewer', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  expect(screen.getByRole('button', { name: 'Ch 1' })).toBeInTheDocument()
})

test('clicking a toc item navigates but keeps the panel open', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Ch 1' }))
  expect(goTo).toHaveBeenCalledWith('c1.xhtml')
  expect(screen.getByRole('button', { name: 'Ch 1' })).toBeInTheDocument()
})

test('toggling contents again closes the panel', async () => {
  await act(async () => { render(<EpubReader bookId="b1" fileUrl="https://x/y.epub" onBack={vi.fn()} />) })
  act(() => {
    (viewerProps.current?.onToc as (t: unknown) => void)([{ label: 'Ch 1', href: 'c1.xhtml', level: 0 }])
  })
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
  await userEvent.click(screen.getByRole('button', { name: /toggle contents/i }))
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
  await waitFor(() => expect(deleteBookmark).toHaveBeenCalledWith('bm1'))
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
