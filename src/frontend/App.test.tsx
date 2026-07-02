import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('@frontend/auth/useSession', () => ({ useSession: () => useSession() }))

test('renders the app title', () => {
  useSession.mockReturnValue({ session: { user: { id: 'u1' } }, loading: false })
  render(<App />)
  expect(screen.getByRole('heading', { name: /e-book reader/i })).toBeInTheDocument()
})
