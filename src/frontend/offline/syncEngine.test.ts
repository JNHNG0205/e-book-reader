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

import { flushOutbox, startAutoSync } from './syncEngine'

function op(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    opId: 'op-1',
    entity: 'highlight',
    kind: 'upsert',
    rowId: 'row-1',
    bookId: 'book-1',
    payload: { id: 'row-1' },
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
})

test('dispatches ops to the correct repo fn, in FIFO order, and removes each on success', async () => {
  const ops = [
    op({ opId: 'a', entity: 'highlight', kind: 'upsert', rowId: 'h1', payload: { id: 'h1' } }),
    op({ opId: 'b', entity: 'highlight', kind: 'delete', rowId: 'h2' }),
    op({ opId: 'c', entity: 'bookmark', kind: 'upsert', rowId: 'b1', payload: { id: 'b1' } }),
    op({ opId: 'd', entity: 'bookmark', kind: 'delete', rowId: 'b2' }),
    op({ opId: 'e', entity: 'progress', kind: 'upsert', bookId: 'book-9', payload: { location: '42' } }),
  ]
  allOps.mockResolvedValue(ops)

  const result = await flushOutbox()

  expect(upsertHighlight).toHaveBeenCalledWith({ id: 'h1' })
  expect(deleteHighlight).toHaveBeenCalledWith('h2')
  expect(upsertBookmark).toHaveBeenCalledWith({ id: 'b1' })
  expect(deleteBookmark).toHaveBeenCalledWith('b2')
  expect(saveProgress).toHaveBeenCalledWith('book-9', '42')

  // FIFO order check via mock invocation call order
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
    op({ opId: 'a', entity: 'highlight', kind: 'upsert', rowId: 'h1', payload: { id: 'h1' } }),
    op({ opId: 'b', entity: 'bookmark', kind: 'upsert', rowId: 'b1', payload: { id: 'b1' } }),
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

test('overlapping flushOutbox calls do not double-dispatch (in-flight guard)', async () => {
  let resolveAllOps: (ops: OutboxOp[]) => void = () => {}
  const opsPromise = new Promise<OutboxOp[]>((resolve) => {
    resolveAllOps = resolve
  })
  allOps.mockReturnValueOnce(opsPromise)

  const first = flushOutbox()
  const second = flushOutbox()

  resolveAllOps([op({ opId: 'a' })])

  const [firstResult, secondResult] = await Promise.all([first, second])

  expect(allOps).toHaveBeenCalledTimes(1)
  expect(upsertHighlight).toHaveBeenCalledTimes(1)
  expect(firstResult).toEqual({ synced: 1, remaining: 0 })
  expect(secondResult).toEqual({ synced: 0, remaining: 0 })
})

test('startAutoSync flushes once immediately (best-effort) and again on window online event', async () => {
  allOps.mockResolvedValue([])

  const unsubscribe = startAutoSync()
  await Promise.resolve()
  await Promise.resolve()

  expect(allOps).toHaveBeenCalledTimes(1)

  allOps.mockClear()
  allOps.mockResolvedValue([])
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
