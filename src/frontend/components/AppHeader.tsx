import { supabase } from '@backend/supabase'

async function logOut() {
  // Drop the cached library list so the next user doesn't briefly see the previous
  // account's books (the cache isn't user-scoped).
  try { localStorage.removeItem('library.books') } catch { /* ignore */ }
  await supabase.auth.signOut()
}

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-line bg-paper-raised px-4 py-3 sm:px-6">
      <h1 className="font-serif text-lg font-semibold tracking-[-0.01em] text-ink">
        E-Book <span className="text-accent">Reader</span>
      </h1>
      <button
        onClick={() => { void logOut() }}
        className="text-sm font-medium text-ink-soft hover:text-accent"
      >
        Log out
      </button>
    </header>
  )
}
