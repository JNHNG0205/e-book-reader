import { beforeEach, expect, test, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { from } }))
vi.mock('./currentUser', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { getProgress, saveProgress, listProgress } from './progress'

beforeEach(() => vi.clearAllMocks())

test('getProgress returns the saved location', async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { location: '12' }, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) })
  expect(await getProgress('b1')).toBe('12')
})

test('getProgress returns null when there is no row', async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) })
  expect(await getProgress('b1')).toBeNull()
})

test('saveProgress upserts location for the user+book', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ upsert })
  await saveProgress('b1', '7', 40)
  expect(upsert).toHaveBeenCalledWith(
    { user_id: 'u1', book_id: 'b1', location: '7', percent: 40 },
    { onConflict: 'user_id,book_id' },
  )
})

test('saveProgress stores null percent when omitted', async () => {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ upsert })
  await saveProgress('b1', '7')
  expect(upsert).toHaveBeenCalledWith(
    { user_id: 'u1', book_id: 'b1', location: '7', percent: null },
    { onConflict: 'user_id,book_id' },
  )
})

test('listProgress returns book_id + percent rows', async () => {
  const select = vi.fn().mockResolvedValue({ data: [{ book_id: 'b1', percent: 40 }], error: null })
  from.mockReturnValue({ select })
  expect(await listProgress()).toEqual([{ book_id: 'b1', percent: 40 }])
})
