import { beforeEach, expect, test, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
})

test('exports a configured supabase client with auth', async () => {
  const { supabase } = await import('./supabase')
  expect(supabase).toBeDefined()
  expect(supabase.auth).toBeDefined()
})
