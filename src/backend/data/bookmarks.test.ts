import { beforeEach, expect, test, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { from } }))
vi.mock('./currentUser', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { listBookmarks, saveBookmark, deleteBookmark } from './bookmarks'

beforeEach(() => vi.clearAllMocks())

test('listBookmarks returns the user rows ordered by created_at asc', async () => {
  const rows = [{ id: 'bm1' }, { id: 'bm2' }]
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ order }) }) })
  expect(await listBookmarks('b1')).toEqual(rows)
  expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
})

test('saveBookmark inserts location + label for the user+book', async () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'bm1' }, error: null })
  const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
  from.mockReturnValue({ insert })
  const bm = await saveBookmark('b1', { location: '7', label: 'Page 7' })
  expect(bm).toEqual({ id: 'bm1' })
  expect(insert).toHaveBeenCalledWith({ user_id: 'u1', book_id: 'b1', location: '7', label: 'Page 7' })
})

test('deleteBookmark deletes by id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ delete: () => ({ eq }) })
  await deleteBookmark('bm1')
  expect(eq).toHaveBeenCalledWith('id', 'bm1')
})
