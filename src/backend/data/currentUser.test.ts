import { beforeEach, expect, test, vi } from 'vitest'

const { getUser, getSession } = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { auth: { getUser, getSession } } }))

import { requireUserId, getUserIdLocal } from './currentUser'

beforeEach(() => vi.clearAllMocks())

test('returns the current user id', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  expect(await requireUserId()).toBe('u1')
})

test('throws when unauthenticated', async () => {
  getUser.mockResolvedValue({ data: { user: null } })
  await expect(requireUserId()).rejects.toThrow(/not authenticated/i)
})

test('getUserIdLocal returns the session user id without calling getUser', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  expect(await getUserIdLocal()).toBe('u1')
  expect(getUser).not.toHaveBeenCalled()
})

test('getUserIdLocal returns null when there is no session', async () => {
  getSession.mockResolvedValue({ data: { session: null } })
  expect(await getUserIdLocal()).toBeNull()
  expect(getUser).not.toHaveBeenCalled()
})
