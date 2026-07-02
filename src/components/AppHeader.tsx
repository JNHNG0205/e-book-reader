import { supabase } from '../lib/supabase'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-bold">E-Book Reader</h1>
      <button onClick={() => { void supabase.auth.signOut() }} className="text-sm text-blue-600">
        Log out
      </button>
    </header>
  )
}
