import { beforeEach, expect, test, vi } from 'vitest'

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { auth: { getUser } } }))

import { requireUserId } from './currentUser'

beforeEach(() => vi.clearAllMocks())

test('returns the current user id', async () => {
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  expect(await requireUserId()).toBe('u1')
})

test('throws when unauthenticated', async () => {
  getUser.mockResolvedValue({ data: { user: null } })
  await expect(requireUserId()).rejects.toThrow(/not authenticated/i)
})
