import { beforeEach, expect, test, vi } from 'vitest'

const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { from } }))
vi.mock('./currentUser', () => ({ requireUserId: vi.fn().mockResolvedValue('u1') }))

import { listHighlights, saveHighlight, updateHighlight, deleteHighlight } from './highlights'

beforeEach(() => vi.clearAllMocks())

test('listHighlights returns the user rows ordered by created_at asc', async () => {
  const rows = [{ id: 'h1' }, { id: 'h2' }]
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  from.mockReturnValue({ select: () => ({ eq: () => ({ order }) }) })
  expect(await listHighlights('b1')).toEqual(rows)
  expect(order).toHaveBeenCalledWith('created_at', { ascending: true })
})

test('saveHighlight inserts color/note/anchor for the user+book', async () => {
  const single = vi.fn().mockResolvedValue({ data: { id: 'h1' }, error: null })
  const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
  from.mockReturnValue({ insert })
  const anchor = { cfiRange: 'epubcfi(/6/4!/2,/1:0,/1:5)', text: 'hello' }
  const h = await saveHighlight('b1', { color: 'yellow', anchor })
  expect(h).toEqual({ id: 'h1' })
  expect(insert).toHaveBeenCalledWith({
    user_id: 'u1', book_id: 'b1', color: 'yellow', note: null, anchor,
  })
})

test('updateHighlight updates the given fields by id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  from.mockReturnValue({ update })
  await updateHighlight('h1', { color: 'green', note: 'nice' })
  expect(update).toHaveBeenCalledWith({ color: 'green', note: 'nice' })
  expect(eq).toHaveBeenCalledWith('id', 'h1')
})

test('deleteHighlight deletes by id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  from.mockReturnValue({ delete: () => ({ eq }) })
  await deleteHighlight('h1')
  expect(eq).toHaveBeenCalledWith('id', 'h1')
})
