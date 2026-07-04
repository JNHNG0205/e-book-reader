import { supabase } from '@backend/supabase'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line bg-paper-raised px-6 py-3">
      <h1 className="font-serif text-lg font-semibold tracking-[-0.01em] text-ink">
        E-Book <span className="text-accent">Reader</span>
      </h1>
      <button
        onClick={() => { void supabase.auth.signOut() }}
        className="text-sm font-medium text-ink-soft hover:text-accent"
      >
        Log out
      </button>
    </header>
  )
}
