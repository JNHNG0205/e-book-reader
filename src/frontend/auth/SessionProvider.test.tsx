import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const { onAuthStateChange, getSession } = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@backend/supabase', () => ({
  supabase: { auth: { getSession, onAuthStateChange } },
}))

import { SessionProvider } from './SessionProvider'
import { useSession } from './useSession'

function Probe() {
  const { session, loading } = useSession()
  if (loading) return <div>loading</div>
  return <div>{session ? 'in' : 'out'}</div>
}

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: null } })
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
})

test('resolves to logged-out when there is no session', async () => {
  render(<SessionProvider><Probe /></SessionProvider>)
  expect(screen.getByText('loading')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument())
})

test('resolves to logged-in when a session exists', async () => {
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  render(<SessionProvider><Probe /></SessionProvider>)
  await waitFor(() => expect(screen.getByText('in')).toBeInTheDocument())
})
