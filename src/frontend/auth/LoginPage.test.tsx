import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

// vi.mock is hoisted above const declarations, so mock fns must be created
// inside vi.hoisted() to be referenceable in the factory.
const { signInWithPassword, signUp, resend } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resend: vi.fn(),
}))
vi.mock('@backend/supabase', () => ({
  supabase: { auth: { signInWithPassword, signUp, resend } },
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

test('signup without session shows confirmation view with email', async () => {
  signUp.mockResolvedValue({
    data: { user: { id: 'u1' }, session: null },
    error: null,
  })
  render(<LoginPage />)
  await userEvent.click(screen.getByRole('button', { name: /need an account/i }))
  await userEvent.type(screen.getByLabelText(/email/i), 'new@user.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'password123')
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
  expect(await screen.findByText(/new@user\.com/)).toBeInTheDocument()
  expect(await screen.findByText(/check your email/i)).toBeInTheDocument()
  expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
})

test('signup with session does NOT show confirmation view', async () => {
  signUp.mockResolvedValue({
    data: { user: { id: 'u1' }, session: { access_token: 'x' } },
    error: null,
  })
  render(<LoginPage />)
  await userEvent.click(screen.getByRole('button', { name: /need an account/i }))
  await userEvent.type(screen.getByLabelText(/email/i), 'new@user.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'password123')
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
  // Wait for async to settle
  await screen.findByRole('button', { name: /sign up/i })
  expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument()
})

test('clicking Resend in confirmation view calls supabase.auth.resend', async () => {
  signUp.mockResolvedValue({
    data: { user: { id: 'u1' }, session: null },
    error: null,
  })
  resend.mockResolvedValue({ error: null })
  render(<LoginPage />)
  await userEvent.click(screen.getByRole('button', { name: /need an account/i }))
  await userEvent.type(screen.getByLabelText(/email/i), 'new@user.com')
  await userEvent.type(screen.getByLabelText(/password/i), 'password123')
  await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
  await screen.findByText(/check your email/i)
  await userEvent.click(screen.getByRole('button', { name: /resend/i }))
  expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'new@user.com' })
  expect(await screen.findByText(/confirmation email resent/i)).toBeInTheDocument()
})
