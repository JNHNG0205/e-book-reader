import { beforeEach, expect, test, vi } from 'vitest'
import type { OutboxOp } from './syncStore'

const { allOps, removeOp } = vi.hoisted(() => ({
  allOps: vi.fn(),
  removeOp: vi.fn(),
}))
vi.mock('./syncStore', () => ({ allOps, removeOp }))

const { upsertHighlight, deleteHighlight } = vi.hoisted(() => ({
  upsertHighlight: vi.fn(),
  deleteHighlight: vi.fn(),
}))
vi.mock('@backend/data/highlights', () => ({ upsertHighlight, deleteHighlight }))

const { upsertBookmark, deleteBookmark } = vi.hoisted(() => ({
  upsertBookmark: vi.fn(),
  deleteBookmark: vi.fn(),
}))
vi.mock('@backend/data/bookmarks', () => ({ upsertBookmark, deleteBookmark }))

const { saveProgress } = vi.hoisted(() => ({
  saveProgress: vi.fn(),
}))
vi.mock('@backend/data/progress', () => ({ saveProgress }))

const { getUserIdLocal } = vi.hoisted(() => ({
  getUserIdLocal: vi.fn(),
}))
vi.mock('@backend/data/currentUser', () => ({ getUserIdLocal }))

import { flushOutbox, startAutoSync } from './syncEngine'

function op(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    opId: 'op-1',
    entity: 'highlight',
    kind: 'upsert',
    rowId: 'row-1',
    bookId: 'book-1',
    payload: { id: 'row-1', user_id: 'u1' },
    ts: 1,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  upsertHighlight.mockResolvedValue(undefined)
  deleteHighlight.mockResolvedValue(undefined)
  upsertBookmark.mockResolvedValue(undefined)
  deleteBookmark.mockResolvedValue(undefined)
  saveProgress.mockResolvedValue(undefined)
  removeOp.mockResolvedValue(undefined)
  getUserIdLocal.mockResolvedValue('u1')
  allOps.mockResolvedValue([]) // default: empty so the drain loop terminates
})

test('dispatches ops to the correct repo fn, in FIFO order, and removes each on success', async () => {
  const ops = [
    op({ opId: 'a', entity: 'highlight', kind: 'upsert', rowId: 'h1', payload: { id: 'h1', user_id: 'u1' } }),
    op({ opId: 'b', entity: 'highlight', kind: 'delete', rowId: 'h2' }),
    op({ opId: 'c', entity: 'bookmark', kind: 'upsert', rowId: 'b1', payload: { id: 'b1', user_id: 'u1' } }),
    op({ opId: 'd', entity: 'bookmark', kind: 'delete', rowId: 'b2' }),
    op({ opId: 'e', entity: 'progress', kind: 'upsert', bookId: 'book-9', payload: { location: '42', percent: 42 } }),
  ]
  allOps.mockResolvedValueOnce(ops) // then default [] ends the drain loop

  const result = await flushOutbox()

  expect(upsertHighlight).toHaveBeenCalledWith({ id: 'h1', user_id: 'u1' })
  expect(deleteHighlight).toHaveBeenCalledWith('h2')
  expect(upsertBookmark).toHaveBeenCalledWith({ id: 'b1', user_id: 'u1' })
  expect(deleteBookmark).toHaveBeenCalledWith('b2')
  expect(saveProgress).toHaveBeenCalledWith('book-9', '42', 42)

  const callOrder = [
    upsertHighlight.mock.invocationCallOrder[0],
    deleteHighlight.mock.invocationCallOrder[0],
    upsertBookmark.mock.invocationCallOrder[0],
    deleteBookmark.mock.invocationCallOrder[0],
    saveProgress.mock.invocationCallOrder[0],
  ]
  expect(callOrder).toEqual([...callOrder].sort((x, y) => x - y))

  expect(removeOp).toHaveBeenCalledTimes(5)
  expect(removeOp).toHaveBeenNthCalledWith(1, 'a')
  expect(removeOp).toHaveBeenNthCalledWith(5, 'e')

  expect(result).toEqual({ synced: 5, remaining: 0 })
})

test('a mid-queue failure stops the flush, leaving the failed op and later ops', async () => {
  const ops = [
    op({ opId: 'a', entity: 'highlight', kind: 'upsert', rowId: 'h1', payload: { id: 'h1', user_id: 'u1' } }),
    op({ opId: 'b', entity: 'bookmark', kind: 'upsert', rowId: 'b1', payload: { id: 'b1', user_id: 'u1' } }),
    op({ opId: 'c', entity: 'progress', kind: 'upsert', bookId: 'book-9', payload: { location: '1' } }),
  ]
  allOps.mockResolvedValue(ops)
  upsertBookmark.mockRejectedValue(new Error('network down'))

  const result = await flushOutbox()

  expect(upsertHighlight).toHaveBeenCalledTimes(1)
  expect(upsertBookmark).toHaveBeenCalledTimes(1)
  expect(saveProgress).not.toHaveBeenCalled()

  expect(removeOp).toHaveBeenCalledTimes(1)
  expect(removeOp).toHaveBeenCalledWith('a')

  expect(result).toEqual({ synced: 1, remaining: 2 })
})

test('drains an op that was enqueued mid-flush (re-reads the outbox after each snapshot)', async () => {
  const a = op({ opId: 'a', rowId: 'h1', payload: { id: 'h1', user_id: 'u1' } })
  const b = op({ opId: 'b', rowId: 'h2', payload: { id: 'h2', user_id: 'u1' } })
  // First snapshot has only A; by the time A is drained, B has appeared; then empty.
  allOps.mockResolvedValueOnce([a]).mockResolvedValueOnce([b]).mockResolvedValue([])

  const result = await flushOutbox()

  expect(upsertHighlight).toHaveBeenCalledWith({ id: 'h1', user_id: 'u1' })
  expect(upsertHighlight).toHaveBeenCalledWith({ id: 'h2', user_id: 'u1' })
  expect(removeOp).toHaveBeenCalledTimes(2)
  expect(result).toEqual({ synced: 2, remaining: 0 })
})

test('backfills an empty user_id from the local session before an upsert', async () => {
  allOps.mockResolvedValueOnce([
    op({ opId: 'a', entity: 'highlight', kind: 'upsert', rowId: 'h1', payload: { id: 'h1' } }),
  ])
  getUserIdLocal.mockResolvedValue('user-42')

  await flushOutbox()

  expect(upsertHighlight).toHaveBeenCalledWith({ id: 'h1', user_id: 'user-42' })
})

test('overlapping flushOutbox calls do not double-dispatch (in-flight guard)', async () => {
  let resolveAllOps: (ops: OutboxOp[]) => void = () => {}
  const opsPromise = new Promise<OutboxOp[]>((resolve) => {
    resolveAllOps = resolve
  })
  allOps.mockReturnValueOnce(opsPromise) // then default [] ends the drain loop

  const first = flushOutbox()
  const second = flushOutbox()

  resolveAllOps([op({ opId: 'a', payload: { id: 'a', user_id: 'u1' } })])

  const [firstResult, secondResult] = await Promise.all([first, second])

  // The second call was skipped by the guard, so only one dispatch happened.
  expect(upsertHighlight).toHaveBeenCalledTimes(1)
  expect(removeOp).toHaveBeenCalledTimes(1)
  expect(firstResult).toEqual({ synced: 1, remaining: 0 })
  expect(secondResult).toEqual({ synced: 0, remaining: 0 })
})

test('startAutoSync flushes once immediately (best-effort) and again on window online event', async () => {
  const unsubscribe = startAutoSync()
  await Promise.resolve()
  await Promise.resolve()

  expect(allOps).toHaveBeenCalledTimes(1)

  allOps.mockClear()
  window.dispatchEvent(new Event('online'))
  await Promise.resolve()
  await Promise.resolve()

  expect(allOps).toHaveBeenCalledTimes(1)

  unsubscribe()
  allOps.mockClear()
  window.dispatchEvent(new Event('online'))
  await Promise.resolve()

  expect(allOps).not.toHaveBeenCalled()
})

test('startAutoSync swallows errors from the initial best-effort flush', async () => {
  allOps.mockRejectedValueOnce(new Error('boom'))
  expect(() => startAutoSync()).not.toThrow()
  await Promise.resolve()
  await Promise.resolve()
})
