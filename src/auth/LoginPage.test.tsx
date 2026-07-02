import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

// vi.mock is hoisted above const declarations, so mock fns must be created
// inside vi.hoisted() to be referenceable in the factory.
const { signInWithPassword, signUp } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword, signUp } },
}))

import { LoginPage } from './LoginPage'

beforeEach(() => vi.clearAllMocks())

test('logs in with email and password', async () => {
  signInWithPassword.mockResolvedValue({ error: null })
  render(<LoginPage />)
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'secret12')
  await userEvent.click(screen.getByRole('button', { name: /log in/i }))
  expect(signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret12' })
})

test('shows an error message when login fails', async () => {
  signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } })
  render(<LoginPage />)
  await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass')
  await userEvent.click(screen.getByRole('button', { name: /log in/i }))
  expect(await screen.findByText(/invalid login credentials/i)).toBeInTheDocument()
})
