import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import {
  enqueueOp,
  allOps,
  removeOp,
  putCachedRows,
  getCachedRows,
  upsertCachedRow,
  removeCachedRow,
  type OutboxOp,
} from './syncStore'

function op(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    opId: crypto.randomUUID(),
    entity: 'highlight',
    kind: 'upsert',
    rowId: 'row-1',
    bookId: 'book-1',
    payload: { id: 'row-1', text: 'hi' },
    ts: 1,
    ...overrides,
  }
}

beforeEach(async () => {
  for (const o of await allOps()) await removeOp(o.opId)
  for (const bookId of ['book-1', 'book-2']) {
    for (const entity of ['highlight', 'bookmark', 'progress'] as const) {
      for (const row of await getCachedRows(entity, bookId)) {
        await removeCachedRow(entity, bookId, row.id)
      }
    }
  }
})

test('enqueueOp then allOps returns ops in FIFO order by ts', async () => {
  const a = op({ opId: 'a', ts: 3 })
  const b = op({ opId: 'b', ts: 1 })
  const c = op({ opId: 'c', ts: 2 })
  await enqueueOp(a)
  await enqueueOp(b)
  await enqueueOp(c)

  const ops = await allOps()
  expect(ops.map((o) => o.opId)).toEqual(['b', 'c', 'a'])
})

test('removeOp drops the op from the outbox', async () => {
  await enqueueOp(op({ opId: 'x' }))
  await enqueueOp(op({ opId: 'y' }))
  await removeOp('x')

  const ops = await allOps()
  expect(ops.map((o) => o.opId)).toEqual(['y'])
})

test('putCachedRows and getCachedRows round-trip for a book', async () => {
  const rows = [
    { id: 'h1', text: 'one' },
    { id: 'h2', text: 'two' },
  ]
  await putCachedRows('highlight', 'book-1', rows)

  const got = await getCachedRows('highlight', 'book-1')
  expect(got.map((r) => r.id).sort()).toEqual(['h1', 'h2'])
})

test('upsertCachedRow inserts a new row and replaces an existing one by id', async () => {
  await upsertCachedRow('highlight', 'book-1', { id: 'h1', text: 'one' })
  await upsertCachedRow('highlight', 'book-1', { id: 'h1', text: 'one-updated' })

  const got = await getCachedRows('highlight', 'book-1')
  expect(got).toHaveLength(1)
  expect(got[0]).toEqual({ id: 'h1', text: 'one-updated' })
})

test('removeCachedRow drops only the targeted row', async () => {
  await putCachedRows('bookmark', 'book-1', [
    { id: 'b1', page: 1 },
    { id: 'b2', page: 2 },
  ])
  await removeCachedRow('bookmark', 'book-1', 'b1')

  const got = await getCachedRows('bookmark', 'book-1')
  expect(got.map((r) => r.id)).toEqual(['b2'])
})

test('caches are isolated per (entity, bookId)', async () => {
  await upsertCachedRow('highlight', 'book-1', { id: 'r1', v: 'h-book1' })
  await upsertCachedRow('bookmark', 'book-1', { id: 'r1', v: 'bm-book1' })
  await upsertCachedRow('highlight', 'book-2', { id: 'r1', v: 'h-book2' })

  expect(await getCachedRows('highlight', 'book-1')).toEqual([{ id: 'r1', v: 'h-book1' }])
  expect(await getCachedRows('bookmark', 'book-1')).toEqual([{ id: 'r1', v: 'bm-book1' }])
  expect(await getCachedRows('highlight', 'book-2')).toEqual([{ id: 'r1', v: 'h-book2' }])
})
