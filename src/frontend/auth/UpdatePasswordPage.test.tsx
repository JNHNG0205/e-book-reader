import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }))
vi.mock('@backend/supabase', () => ({ supabase: { auth: { updateUser } } }))

import { UpdatePasswordPage } from './UpdatePasswordPage'

beforeEach(() => vi.clearAllMocks())

test('updates the password when the two fields match', async () => {
  updateUser.mockResolvedValue({ error: null })
  render(<UpdatePasswordPage />)
  await userEvent.type(screen.getByLabelText('New password'), 'newsecret1')
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'newsecret1')
  await userEvent.click(screen.getByRole('button', { name: /update password/i }))
  expect(updateUser).toHaveBeenCalledWith({ password: 'newsecret1' })
  expect(await screen.findByText(/password updated/i)).toBeInTheDocument()
})

test('shows an error and does not call updateUser when the fields differ', async () => {
  render(<UpdatePasswordPage />)
  await userEvent.type(screen.getByLabelText('New password'), 'newsecret1')
  await userEvent.type(screen.getByLabelText('Confirm new password'), 'different')
  await userEvent.click(screen.getByRole('button', { name: /update password/i }))
  expect(await screen.findByText(/don.t match/i)).toBeInTheDocument()
  expect(updateUser).not.toHaveBeenCalled()
})
