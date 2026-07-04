import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

// vi.mock is hoisted; create the mock fn via vi.hoisted() so the factory can use it.
const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@frontend/auth/useSession', () => ({ useSession: () => useSession() }))
vi.mock('@frontend/auth/LoginPage', () => ({ LoginPage: () => <div>login page</div> }))
vi.mock('@frontend/auth/UpdatePasswordPage', () => ({ UpdatePasswordPage: () => <div>set new password</div> }))

import { ProtectedRoute } from './ProtectedRoute'

test('renders login page when logged out', () => {
  useSession.mockReturnValue({ session: null, loading: false })
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>)
  expect(screen.getByText('login page')).toBeInTheDocument()
  expect(screen.queryByText('secret')).not.toBeInTheDocument()
})

test('renders children when logged in', () => {
  useSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>)
  expect(screen.getByText('secret')).toBeInTheDocument()
})

test('shows the set-new-password screen during recovery, not the app', () => {
  useSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false, recovery: true })
  render(<ProtectedRoute><div>secret</div></ProtectedRoute>)
  expect(screen.getByText('set new password')).toBeInTheDocument()
  expect(screen.queryByText('secret')).not.toBeInTheDocument()
})
