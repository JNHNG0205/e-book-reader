import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { putCachedBook, getCachedBook, hasCachedBook, deleteCachedBook, cachedBookIds } from './bookCache'

function bytes(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer
}

beforeEach(async () => {
  for (const id of await cachedBookIds()) await deleteCachedBook(id)
})

test('stores and reads back book bytes', async () => {
  await putCachedBook('b1', bytes('hello'))
  const got = await getCachedBook('b1')
  expect(got).not.toBeNull()
  expect(new TextDecoder().decode(new Uint8Array(got!))).toBe('hello')
})

test('reports presence and lists ids', async () => {
  expect(await hasCachedBook('b1')).toBe(false)
  await putCachedBook('b1', bytes('x'))
  await putCachedBook('b2', bytes('y'))
  expect(await hasCachedBook('b1')).toBe(true)
  expect((await cachedBookIds()).sort()).toEqual(['b1', 'b2'])
})

test('getCachedBook returns null for a miss', async () => {
  expect(await getCachedBook('nope')).toBeNull()
})

test('deletes a cached book', async () => {
  await putCachedBook('b1', bytes('x'))
  await deleteCachedBook('b1')
  expect(await hasCachedBook('b1')).toBe(false)
})
