import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { CachedRow, OutboxOp } from './syncStore'

const { getCachedRows, putCachedRows, upsertCachedRow, removeCachedRow, enqueueOp, allOps } = vi.hoisted(() => ({
  getCachedRows: vi.fn(),
  putCachedRows: vi.fn(),
  upsertCachedRow: vi.fn(),
  removeCachedRow: vi.fn(),
  enqueueOp: vi.fn(),
  allOps: vi.fn(),
}))
vi.mock('./syncStore', () => ({ getCachedRows, putCachedRows, upsertCachedRow, removeCachedRow, enqueueOp, allOps }))

const { flushOutbox } = vi.hoisted(() => ({ flushOutbox: vi.fn() }))
vi.mock('./syncEngine', () => ({ flushOutbox }))

const { listHighlightsRemote } = vi.hoisted(() => ({ listHighlightsRemote: vi.fn() }))
vi.mock('@backend/data/highlights', () => ({ listHighlights: listHighlightsRemote }))

const { listBookmarksRemote } = vi.hoisted(() => ({ listBookmarksRemote: vi.fn() }))
vi.mock('@backend/data/bookmarks', () => ({ listBookmarks: listBookmarksRemote }))

const { getProgressRemote } = vi.hoisted(() => ({ getProgressRemote: vi.fn() }))
vi.mock('@backend/data/progress', () => ({ getProgress: getProgressRemote }))

const { getUserIdLocal } = vi.hoisted(() => ({ getUserIdLocal: vi.fn() }))
vi.mock('@backend/data/currentUser', () => ({ getUserIdLocal }))

import {
  listHighlights,
  saveHighlight,
  updateHighlight,
  deleteHighlight,
  listBookmarks,
  saveBookmark,
  deleteBookmark,
  getProgress,
  saveProgress,
} from './offlineData'

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUserIdLocal.mockResolvedValue('user-1')
  flushOutbox.mockResolvedValue({ synced: 0, remaining: 0 })
  putCachedRows.mockResolvedValue(undefined)
  upsertCachedRow.mockResolvedValue(undefined)
  removeCachedRow.mockResolvedValue(undefined)
  enqueueOp.mockResolvedValue(undefined)
  allOps.mockResolvedValue([])
  setOnline(true)
})

afterEach(() => {
  setOnline(true)
})

// ---- Highlights: list ----

test('listHighlights returns cache immediately when offline', async () => {
  setOnline(false)
  const cached: CachedRow[] = [{ id: 'h1', color: 'red' }]
  getCachedRows.mockResolvedValue(cached)

  const result = await listHighlights('book-1')

  expect(result).toEqual(cached)
  expect(listHighlightsRemote).not.toHaveBeenCalled()
  expect(putCachedRows).not.toHaveBeenCalled()
})

test('listHighlights merges server + pending upserts and drops pending deletes when online', async () => {
  getCachedRows.mockResolvedValue([{ id: 'h1', color: 'red' }])
  listHighlightsRemote.mockResolvedValue([
    { id: 'h1', color: 'red', book_id: 'book-1' },
    { id: 'h2', color: 'blue', book_id: 'book-1' },
    { id: 'h3', color: 'green', book_id: 'book-1' },
  ])
  allOps.mockResolvedValue([
    // pending upsert not yet on server (new local highlight)
    {
      opId: 'op-1',
      entity: 'highlight',
      kind: 'upsert',
      rowId: 'h-local',
      bookId: 'book-1',
      payload: { id: 'h-local', color: 'yellow', book_id: 'book-1' },
      ts: 1,
    },
    // pending delete for h3
    { opId: 'op-2', entity: 'highlight', kind: 'delete', rowId: 'h3', bookId: 'book-1', payload: {}, ts: 2 },
    // op for a different book, should be ignored
    {
      opId: 'op-3',
      entity: 'highlight',
      kind: 'upsert',
      rowId: 'x',
      bookId: 'other-book',
      payload: { id: 'x' },
      ts: 3,
    },
    // op for a different entity, should be ignored
    { opId: 'op-4', entity: 'bookmark', kind: 'upsert', rowId: 'y', bookId: 'book-1', payload: { id: 'y' }, ts: 4 },
  ] as OutboxOp[])

  const result = await listHighlights('book-1')

  const ids = result.map((r) => (r as { id: string }).id).sort()
  expect(ids).toEqual(['h-local', 'h1', 'h2'])
  expect(putCachedRows).toHaveBeenCalledTimes(1)
  const [entity, bookId, rows] = putCachedRows.mock.calls[0]
  expect(entity).toBe('highlight')
  expect(bookId).toBe('book-1')
  expect((rows as { id: string }[]).map((r) => r.id).sort()).toEqual(['h-local', 'h1', 'h2'])
})

test('listHighlights falls back to cache if the network read throws', async () => {
  const cached: CachedRow[] = [{ id: 'h1', color: 'red' }]
  getCachedRows.mockResolvedValue(cached)
  listHighlightsRemote.mockRejectedValue(new Error('network down'))

  const result = await listHighlights('book-1')

  expect(result).toEqual(cached)
  expect(putCachedRows).not.toHaveBeenCalled()
})

// ---- Highlights: save/update/delete ----

test('saveHighlight builds a full row, caches it, enqueues an upsert, and does not throw offline', async () => {
  setOnline(false)
  flushOutbox.mockRejectedValue(new Error('offline'))

  const row = await saveHighlight('book-1', { color: 'red', note: 'hi', anchor: { page: 1 } })

  expect(typeof row.id).toBe('string')
  expect(row.id.length).toBeGreaterThan(0)
  expect(row.user_id).toBe('user-1')
  expect(row.book_id).toBe('book-1')
  expect(row.color).toBe('red')
  expect(row.note).toBe('hi')
  expect(row.anchor).toEqual({ page: 1 })
  expect(typeof row.created_at).toBe('string')
  expect(typeof row.updated_at).toBe('string')

  expect(upsertCachedRow).toHaveBeenCalledWith('highlight', 'book-1', row)
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({
      entity: 'highlight',
      kind: 'upsert',
      rowId: row.id,
      bookId: 'book-1',
      payload: row,
    }),
  )

  // allow the fire-and-forget flush's rejection to be observed without throwing
  await Promise.resolve()
  await Promise.resolve()
})

test('saveHighlight defaults user_id to empty string when no local user is cached', async () => {
  getUserIdLocal.mockResolvedValue(null)

  const row = await saveHighlight('book-1', { color: 'red', note: null, anchor: {} })

  expect(row.user_id).toBe('')
})

test('updateHighlight merges fields into the cached row and enqueues the merged row', async () => {
  getCachedRows.mockResolvedValue([{ id: 'h1', color: 'red', note: null, book_id: 'book-1' }])

  await updateHighlight('book-1', 'h1', { color: 'blue' })

  expect(upsertCachedRow).toHaveBeenCalledTimes(1)
  const [entity, bookId, mergedRow] = upsertCachedRow.mock.calls[0]
  expect(entity).toBe('highlight')
  expect(bookId).toBe('book-1')
  expect((mergedRow as { color: string }).color).toBe('blue')
  expect((mergedRow as { id: string }).id).toBe('h1')

  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({ entity: 'highlight', kind: 'upsert', rowId: 'h1', bookId: 'book-1' }),
  )
})

test('deleteHighlight removes the cached row and enqueues a delete', async () => {
  await deleteHighlight('book-1', 'h1')

  expect(removeCachedRow).toHaveBeenCalledWith('highlight', 'book-1', 'h1')
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({ entity: 'highlight', kind: 'delete', rowId: 'h1', bookId: 'book-1' }),
  )
  expect(flushOutbox).toHaveBeenCalled()
})

// ---- Bookmarks ----

test('listBookmarks returns cache offline', async () => {
  setOnline(false)
  const cached: CachedRow[] = [{ id: 'b1', location: '10' }]
  getCachedRows.mockResolvedValue(cached)

  const result = await listBookmarks('book-1')

  expect(result).toEqual(cached)
  expect(listBookmarksRemote).not.toHaveBeenCalled()
})

test('saveBookmark builds a full row and enqueues an upsert', async () => {
  const row = await saveBookmark('book-1', { location: '42', label: 'chapter 2' })

  expect(row.book_id).toBe('book-1')
  expect(row.location).toBe('42')
  expect(row.label).toBe('chapter 2')
  expect(upsertCachedRow).toHaveBeenCalledWith('bookmark', 'book-1', row)
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({ entity: 'bookmark', kind: 'upsert', rowId: row.id, bookId: 'book-1' }),
  )
})

test('deleteBookmark removes cached row and enqueues a delete', async () => {
  await deleteBookmark('book-1', 'b1')

  expect(removeCachedRow).toHaveBeenCalledWith('bookmark', 'book-1', 'b1')
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({ entity: 'bookmark', kind: 'delete', rowId: 'b1', bookId: 'book-1' }),
  )
})

// ---- Progress ----

test('getProgress returns cached location offline', async () => {
  setOnline(false)
  getCachedRows.mockResolvedValue([{ id: 'book-1', location: '7' }])

  const result = await getProgress('book-1')

  expect(result).toBe('7')
  expect(getProgressRemote).not.toHaveBeenCalled()
})

test('getProgress fetches server value, caches it, and returns it when online', async () => {
  getCachedRows.mockResolvedValue([{ id: 'book-1', location: '7' }])
  getProgressRemote.mockResolvedValue('99')

  const result = await getProgress('book-1')

  expect(result).toBe('99')
  expect(upsertCachedRow).toHaveBeenCalledWith(
    'progress',
    'book-1',
    expect.objectContaining({ id: 'book-1', book_id: 'book-1', location: '99' }),
  )
})

test('getProgress returns null when nothing cached and offline', async () => {
  setOnline(false)
  getCachedRows.mockResolvedValue([])

  const result = await getProgress('book-1')

  expect(result).toBeNull()
})

test('saveProgress upserts a cached progress row and enqueues an upsert with percent', async () => {
  await saveProgress('book-1', '55', 60)

  expect(upsertCachedRow).toHaveBeenCalledWith(
    'progress',
    'book-1',
    expect.objectContaining({ id: 'book-1', book_id: 'book-1', location: '55', percent: 60 }),
  )
  expect(enqueueOp).toHaveBeenCalledWith(
    expect.objectContaining({
      entity: 'progress',
      kind: 'upsert',
      rowId: 'book-1',
      bookId: 'book-1',
      payload: { location: '55', percent: 60 },
    }),
  )
  expect(flushOutbox).toHaveBeenCalled()
})
