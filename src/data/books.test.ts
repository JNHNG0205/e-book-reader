import { beforeEach, expect, test, vi } from 'vitest'

// vi.mock is hoisted; create mock fns via vi.hoisted() so the factory can use them.
const { getUser, from, storageFrom } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser }, from, storage: { from: storageFrom } },
}))

import { listBooks, uploadBook, renameBook, deleteBook } from './books'

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

test('listBooks returns the user rows ordered by created_at desc', async () => {
  const rows = [{ id: 'b1' }, { id: 'b2' }]
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  from.mockReturnValue({ select: () => ({ order }) })
  const result = await listBooks()
  expect(result).toEqual(rows)
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
})

test('uploadBook stores the file under the user folder and inserts a row', async () => {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'x' }, error: null })
  storageFrom.mockReturnValue({ upload })
  const single = vi.fn().mockResolvedValue({ data: { id: 'b1', title: 'T' }, error: null })
  from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) })

  const file = new File(['%PDF'], 'book.pdf', { type: 'application/pdf' })
  const book = await uploadBook(file, { title: 'T', format: 'pdf' })

  expect(book).toEqual({ id: 'b1', title: 'T' })
  const uploadedPath = upload.mock.calls[0][0] as string
  expect(uploadedPath.startsWith('u1/')).toBe(true)
  expect(uploadedPath.endsWith('.pdf')).toBe(true)
})

test('renameBook updates the title for the given id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  from.mockReturnValue({ update })
  await renameBook('b1', 'New Title')
  expect(update).toHaveBeenCalledWith({ title: 'New Title' })
  expect(eq).toHaveBeenCalledWith('id', 'b1')
})

test('deleteBook removes the storage object and deletes the row', async () => {
  const single = vi.fn().mockResolvedValue({ data: { storage_path: 'u1/abc.pdf' }, error: null })
  const selectEq = vi.fn().mockReturnValue({ single })
  const deleteEq = vi.fn().mockResolvedValue({ error: null })
  from
    .mockReturnValueOnce({ select: () => ({ eq: selectEq }) })
    .mockReturnValueOnce({ delete: () => ({ eq: deleteEq }) })

  const remove = vi.fn().mockResolvedValue({ error: null })
  storageFrom.mockReturnValue({ remove })

  await deleteBook('b1')

  expect(remove).toHaveBeenCalledWith(['u1/abc.pdf'])
  expect(deleteEq).toHaveBeenCalledWith('id', 'b1')
})
