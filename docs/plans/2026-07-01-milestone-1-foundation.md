# Milestone 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user can sign up, log in, upload a PDF or EPUB, and see/rename/delete it on their own private bookshelf — with data isolated per user by the database.

**Architecture:** React + Vite SPA talking to Supabase (Auth + Postgres + Storage). UI never touches the Supabase client directly; all persistence goes through repository modules in `src/data/`. Postgres Row-Level Security enforces that each user only reads/writes their own rows and files.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind CSS 3, `@supabase/supabase-js` 2, `react-router-dom` 6, Vitest + React Testing Library.

## Global Constraints

- **Per-user isolation is enforced in the database (RLS), not the client.** Every table and storage bucket has RLS policies keyed on `auth.uid() = user_id`.
- **Repository pattern is mandatory.** Components import from `src/data/*`; they must never `import { supabase }` directly. (This is what makes Milestone 6's offline swap a local change.)
- **Shared types live in `src/types.ts`** and are the single source of truth.
- **All four tables** (`books`, `reading_progress`, `highlights`, `bookmarks`) are created in the M1 migration even though M1 only uses `books` — one clean migration up front.
- **Auth method: email + password** (finalized from spec's open choice — simplest and locally testable; magic link can be added later without schema change).
- TypeScript `strict` mode on. No `any` in committed code.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `.env.example`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a running Vite app; `App` component default-exported from `src/App.tsx`; Vitest configured with jsdom + RTL matchers.

- [ ] **Step 1: Create the Vite project and install dependencies**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @supabase/supabase-js react-router-dom
npm install -D tailwindcss postcss autoprefixer vitest jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event
npx tailwindcss init -p
```
Expected: `node_modules/` populated, `tailwind.config.js` + `postcss.config.js` created. (If `npm create vite` refuses because the dir is non-empty, choose "Ignore files and continue" / rerun with `--force`; it preserves `docs/` and `.git/`.)

- [ ] **Step 2: Configure Tailwind**

Replace `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Replace `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 3: Configure Vitest**

Replace `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

Add scripts to `package.json` (merge into existing `"scripts"`):
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Minimal App and env template**

Replace `src/App.tsx`:
```tsx
export default function App() {
  return <h1 className="text-2xl font-bold">E-Book Reader</h1>
}
```

Ensure `src/main.tsx` imports the stylesheet:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Create `.env.example`:
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 5: Write the smoke test**

Create `src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the app title', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: /e-book reader/i })).toBeInTheDocument()
})
```

- [ ] **Step 6: Run the test — verify it passes**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite react app with tailwind and vitest"
```

---

### Task 2: Shared types + Supabase client

**Files:**
- Create: `src/types.ts`, `src/lib/supabase.ts`
- Test: `src/lib/supabase.test.ts`

**Interfaces:**
- Consumes: env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Produces:
  - `src/types.ts`: `BookFormat = 'pdf' | 'epub'`; `Book`, `ReadingProgress`, `Highlight`, `Bookmark` interfaces.
  - `src/lib/supabase.ts`: `export const supabase: SupabaseClient`.

- [ ] **Step 1: Define shared types**

Create `src/types.ts`:
```ts
export type BookFormat = 'pdf' | 'epub'

export interface Book {
  id: string
  user_id: string
  title: string
  author: string | null
  format: BookFormat
  storage_path: string
  cover_path: string | null
  total_pages: number | null
  created_at: string
  updated_at: string
}

export interface ReadingProgress {
  id: string
  user_id: string
  book_id: string
  location: string // PDF: page number as string; EPUB: CFI
  updated_at: string
}

export interface Highlight {
  id: string
  user_id: string
  book_id: string
  color: string
  note: string | null
  anchor: Record<string, unknown> // PDF: {page,rects,text}; EPUB: {cfiRange,text}
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  user_id: string
  book_id: string
  location: string
  label: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Write the failing test for the client**

Create `src/lib/supabase.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
})

test('exports a configured supabase client with auth', async () => {
  const { supabase } = await import('./supabase')
  expect(supabase).toBeDefined()
  expect(supabase.auth).toBeDefined()
})
```

- [ ] **Step 3: Run test — verify it fails**

Run: `npm test src/lib/supabase.test.ts`
Expected: FAIL — cannot find module `./supabase`.

- [ ] **Step 4: Implement the client**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, anonKey)
```

- [ ] **Step 5: Run test — verify it passes**

Run: `npm test src/lib/supabase.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared types and supabase client"
```

---

### Task 3: Database schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_init.sql`, `docs/guides/supabase-setup.md`

**Interfaces:**
- Consumes: a Supabase project (created via dashboard).
- Produces: tables `books`, `reading_progress`, `highlights`, `bookmarks` with RLS; storage bucket `books` with per-owner RLS. Column names match `src/types.ts`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_init.sql`:
```sql
-- Extensions
create extension if not exists "pgcrypto";

-- Helper: auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- BOOKS
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  format text not null check (format in ('pdf','epub')),
  storage_path text not null,
  cover_path text,
  total_pages int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger books_updated before update on public.books
  for each row execute function public.set_updated_at();

-- READING PROGRESS
create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  location text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create trigger reading_progress_updated before update on public.reading_progress
  for each row execute function public.set_updated_at();

-- HIGHLIGHTS
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  color text not null,
  note text,
  anchor jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger highlights_updated before update on public.highlights
  for each row execute function public.set_updated_at();

-- BOOKMARKS
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  location text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bookmarks_updated before update on public.bookmarks
  for each row execute function public.set_updated_at();

-- Row-Level Security: owner-only for every table
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.highlights enable row level security;
alter table public.bookmarks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['books','reading_progress','highlights','bookmarks'] loop
    execute format($f$
      create policy "own_select_%1$s" on public.%1$s for select using (auth.uid() = user_id);
      create policy "own_insert_%1$s" on public.%1$s for insert with check (auth.uid() = user_id);
      create policy "own_update_%1$s" on public.%1$s for update using (auth.uid() = user_id);
      create policy "own_delete_%1$s" on public.%1$s for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- Storage bucket for book files (private) + per-owner policies.
-- Files are stored under a path prefixed by the user's id: `<uid>/<book_id>.<ext>`.
insert into storage.buckets (id, name, public)
  values ('books', 'books', false)
  on conflict (id) do nothing;

create policy "own_read_books_files" on storage.objects for select
  using (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_write_books_files" on storage.objects for insert
  with check (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_delete_books_files" on storage.objects for delete
  using (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Document how to create the project and apply the migration**

Create `docs/guides/supabase-setup.md`:
```markdown
# Supabase setup

1. Create a project at https://supabase.com → copy the Project URL and anon key.
2. Put them in `.env.local`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
3. Apply the schema: open the project's **SQL Editor**, paste the contents of
   `supabase/migrations/0001_init.sql`, and Run. (Or use the Supabase CLI:
   `supabase db push`.)
4. Auth → Providers: ensure **Email** is enabled. For local dev, turn **off**
   "Confirm email" so signups log in immediately.
5. Verify: Table Editor shows `books`, `reading_progress`, `highlights`,
   `bookmarks`; Storage shows a private `books` bucket.
```

- [ ] **Step 3: Apply the migration and verify manually**

Follow `docs/guides/supabase-setup.md` steps 1–5 against a real project.
Expected: four tables + `books` bucket exist; RLS is enabled (shield icon) on each table.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add database schema, RLS policies, and storage bucket"
```

---

### Task 4: Session context + auth hook

**Files:**
- Create: `src/auth/SessionProvider.tsx`, `src/auth/useSession.ts`
- Test: `src/auth/SessionProvider.test.tsx`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase.ts`.
- Produces:
  - `<SessionProvider>` wrapping the app.
  - `useSession(): { session: Session | null; loading: boolean }` hook.

- [ ] **Step 1: Write the failing test**

Create `src/auth/SessionProvider.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

const onAuthStateChange = vi.fn()
const getSession = vi.fn()
vi.mock('../lib/supabase', () => ({
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
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test src/auth/SessionProvider.test.tsx`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement the context + provider**

Create `src/auth/SessionProvider.tsx`:
```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface SessionState {
  session: Session | null
  loading: boolean
}

export const SessionContext = createContext<SessionState>({ session: null, loading: true })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  return <SessionContext.Provider value={{ session, loading }}>{children}</SessionContext.Provider>
}
```

Create `src/auth/useSession.ts`:
```ts
import { useContext } from 'react'
import { SessionContext } from './SessionProvider'

export function useSession() {
  return useContext(SessionContext)
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test src/auth/SessionProvider.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add session provider and useSession hook"
```

---

### Task 5: Login / signup page

**Files:**
- Create: `src/auth/LoginPage.tsx`
- Test: `src/auth/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, `supabase.auth.signUp`.
- Produces: `<LoginPage />` with email/password fields, a mode toggle (Log in / Sign up), and inline error text.

- [ ] **Step 1: Write the failing test**

Create `src/auth/LoginPage.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const signInWithPassword = vi.fn()
const signUp = vi.fn()
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
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test src/auth/LoginPage.test.tsx`
Expected: FAIL — `./LoginPage` not found.

- [ ] **Step 3: Implement the page**

Create `src/auth/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) setError(error.message)
  }

  return (
    <div className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-6 text-2xl font-bold">
        {mode === 'login' ? 'Log in' : 'Sign up'}
      </h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm">Password</span>
          <input
            type="password" required minLength={6} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
        >
          {mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        className="mt-4 text-sm text-blue-600"
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test src/auth/LoginPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add email/password login and signup page"
```

---

### Task 6: App shell, routing, and protected route

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`
- Create: `src/components/ProtectedRoute.tsx`, `src/components/AppHeader.tsx`
- Test: `src/components/ProtectedRoute.test.tsx`

**Interfaces:**
- Consumes: `useSession`, `LoginPage`, `supabase.auth.signOut`.
- Produces:
  - `<ProtectedRoute>` — shows `LoginPage` when logged out, its children when logged in, a spinner while loading.
  - `<AppHeader>` — app title + "Log out" button.
  - `App` renders routes: `/` → protected `LibraryPage` (placeholder until Task 8).

- [ ] **Step 1: Write the failing test for ProtectedRoute**

Create `src/components/ProtectedRoute.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'

const useSession = vi.fn()
vi.mock('../auth/useSession', () => ({ useSession: () => useSession() }))
vi.mock('../auth/LoginPage', () => ({ LoginPage: () => <div>login page</div> }))

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
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test src/components/ProtectedRoute.test.tsx`
Expected: FAIL — `./ProtectedRoute` not found.

- [ ] **Step 3: Implement ProtectedRoute and AppHeader**

Create `src/components/ProtectedRoute.tsx`:
```tsx
import type { ReactNode } from 'react'
import { useSession } from '../auth/useSession'
import { LoginPage } from '../auth/LoginPage'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  if (loading) return <div className="mt-24 text-center">Loading…</div>
  if (!session) return <LoginPage />
  return <>{children}</>
}
```

Create `src/components/AppHeader.tsx`:
```tsx
import { supabase } from '../lib/supabase'

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-bold">E-Book Reader</h1>
      <button onClick={() => supabase.auth.signOut()} className="text-sm text-blue-600">
        Log out
      </button>
    </header>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `npm test src/components/ProtectedRoute.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire routing in App and main**

Replace `src/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AppHeader } from './components/AppHeader'
import { LibraryPage } from './pages/LibraryPage'

export default function App() {
  return (
    <BrowserRouter>
      <ProtectedRoute>
        <AppHeader />
        <Routes>
          <Route path="/" element={<LibraryPage />} />
        </Routes>
      </ProtectedRoute>
    </BrowserRouter>
  )
}
```

Create a placeholder `src/pages/LibraryPage.tsx` (replaced in Task 8) so the app compiles:
```tsx
export function LibraryPage() {
  return <div className="p-6">Library coming soon</div>
}
```

Wrap the app in `SessionProvider` in `src/main.tsx`:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { SessionProvider } from './auth/SessionProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
)
```

- [ ] **Step 6: Run the whole suite — verify green**

Run: `npm test`
Expected: all tests pass. Also run `npm run build` — expect a clean type-check + build.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add routing, protected route, and app header"
```

---

### Task 7: Books repository

**Files:**
- Create: `src/data/books.ts`
- Test: `src/data/books.test.ts`

**Interfaces:**
- Consumes: `supabase` (auth + `from('books')` + `storage.from('books')`), `Book`, `BookFormat`.
- Produces (the interface later milestones depend on):
  - `listBooks(): Promise<Book[]>` — current user's books, newest first.
  - `uploadBook(file: File, meta: { title: string; author?: string; format: BookFormat }): Promise<Book>` — uploads the file to `books/<uid>/<uuid>.<ext>` and inserts a row.
  - `renameBook(id: string, title: string): Promise<void>`
  - `deleteBook(id: string): Promise<void>` — deletes the row and the storage object.

- [ ] **Step 1: Write the failing tests**

Create `src/data/books.test.ts`:
```ts
import { beforeEach, expect, test, vi } from 'vitest'

const getUser = vi.fn()
const from = vi.fn()
const storageFrom = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser }, from, storage: { from: storageFrom } },
}))

import { listBooks, uploadBook, renameBook } from './books'

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
})

test('listBooks returns the user rows ordered by created_at desc', async () => {
  const rows = [{ id: 'b1' }, { id: 'b2' }]
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  from.mockReturnValue({ select: () => ({ order }) })
  const result = await listBooks()
  expect(result).toEqual(rows)
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
})

test('uploadBook stores the file under the user folder and inserts a row', async () => {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'x' }, error: null })
  storageFrom.mockReturnValue({ upload })
  const single = vi.fn().mockResolvedValue({ data: { id: 'b1', title: 'T' }, error: null })
  from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) })

  const file = new File(['%PDF'], 'book.pdf', { type: 'application/pdf' })
  const book = await uploadBook(file, { title: 'T', format: 'pdf' })

  expect(book).toEqual({ id: 'b1', title: 'T' })
  const uploadedPath = upload.mock.calls[0][0] as string
  expect(uploadedPath.startsWith('u1/')).toBe(true)
  expect(uploadedPath.endsWith('.pdf')).toBe(true)
})

test('renameBook updates the title for the given id', async () => {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  from.mockReturnValue({ update })
  await renameBook('b1', 'New Title')
  expect(update).toHaveBeenCalledWith({ title: 'New Title' })
  expect(eq).toHaveBeenCalledWith('id', 'b1')
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test src/data/books.test.ts`
Expected: FAIL — `./books` not found.

- [ ] **Step 3: Implement the repository**

Create `src/data/books.ts`:
```ts
import { supabase } from '../lib/supabase'
import type { Book, BookFormat } from '../types'

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Not authenticated')
  return data.user.id
}

export async function listBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Book[]
}

export async function uploadBook(
  file: File,
  meta: { title: string; author?: string; format: BookFormat },
): Promise<Book> {
  const userId = await requireUserId()
  const ext = meta.format === 'pdf' ? 'pdf' : 'epub'
  const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage.from('books').upload(storagePath, file)
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('books')
    .insert({
      user_id: userId,
      title: meta.title,
      author: meta.author ?? null,
      format: meta.format,
      storage_path: storagePath,
    })
    .select()
    .single()
  if (error) throw error
  return data as Book
}

export async function renameBook(id: string, title: string): Promise<void> {
  const { error } = await supabase.from('books').update({ title }).eq('id', id)
  if (error) throw error
}

export async function deleteBook(id: string): Promise<void> {
  const { data: book, error: readErr } = await supabase
    .from('books').select('storage_path').eq('id', id).single()
  if (readErr) throw readErr
  if (book?.storage_path) {
    await supabase.storage.from('books').remove([book.storage_path])
  }
  const { error } = await supabase.from('books').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npm test src/data/books.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add books repository (list, upload, rename, delete)"
```

---

### Task 8: Library page + book card

**Files:**
- Modify: `src/pages/LibraryPage.tsx` (replace placeholder)
- Create: `src/components/BookCard.tsx`, `src/components/UploadButton.tsx`
- Test: `src/pages/LibraryPage.test.tsx`

**Interfaces:**
- Consumes: `listBooks`, `uploadBook`, `renameBook`, `deleteBook` from `src/data/books.ts`; `Book`, `BookFormat`.
- Produces: `<LibraryPage />` — loads and shows the user's books in a grid, an upload control that detects format from the file extension, and per-card rename/delete.

- [ ] **Step 1: Write the failing test**

Create `src/pages/LibraryPage.test.tsx`:
```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const listBooks = vi.fn()
const uploadBook = vi.fn()
const deleteBook = vi.fn()
const renameBook = vi.fn()
vi.mock('../data/books', () => ({ listBooks, uploadBook, deleteBook, renameBook }))

import { LibraryPage } from './LibraryPage'

beforeEach(() => {
  vi.clearAllMocks()
  listBooks.mockResolvedValue([
    { id: 'b1', title: 'Dune', author: 'Herbert', format: 'pdf', cover_path: null },
  ])
})

test('renders books from the repository', async () => {
  render(<LibraryPage />)
  expect(await screen.findByText('Dune')).toBeInTheDocument()
  expect(screen.getByText('Herbert')).toBeInTheDocument()
})

test('uploads a selected pdf file with format inferred from extension', async () => {
  uploadBook.mockResolvedValue({ id: 'b2', title: 'book', author: null, format: 'pdf' })
  render(<LibraryPage />)
  await screen.findByText('Dune')
  const file = new File(['%PDF'], 'My Book.pdf', { type: 'application/pdf' })
  const input = screen.getByLabelText(/add book/i)
  await userEvent.upload(input, file)
  await waitFor(() =>
    expect(uploadBook).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ title: 'My Book', format: 'pdf' }),
    ),
  )
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npm test src/pages/LibraryPage.test.tsx`
Expected: FAIL — placeholder `LibraryPage` has no such behavior.

- [ ] **Step 3: Implement BookCard**

Create `src/components/BookCard.tsx`:
```tsx
import type { Book } from '../types'

export function BookCard({
  book, onRename, onDelete,
}: {
  book: Book
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex flex-col rounded border p-3">
      <div className="mb-2 flex aspect-[3/4] items-center justify-center rounded bg-gray-100 text-gray-400">
        {book.format.toUpperCase()}
      </div>
      <div className="font-medium">{book.title}</div>
      {book.author && <div className="text-sm text-gray-500">{book.author}</div>}
      <div className="mt-2 flex gap-3 text-sm">
        <button
          className="text-blue-600"
          onClick={() => {
            const title = window.prompt('New title', book.title)
            if (title && title !== book.title) onRename(book.id, title)
          }}
        >
          Rename
        </button>
        <button
          className="text-red-600"
          onClick={() => {
            if (window.confirm(`Delete "${book.title}"?`)) onDelete(book.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement UploadButton**

Create `src/components/UploadButton.tsx`:
```tsx
import type { ChangeEvent } from 'react'
import type { BookFormat } from '../types'

function inferFormat(filename: string): BookFormat | null {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.endsWith('.epub')) return 'epub'
  return null
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

export function UploadButton({
  onUpload,
}: {
  onUpload: (file: File, meta: { title: string; format: BookFormat }) => void
}) {
  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const format = inferFormat(file.name)
    if (!format) {
      window.alert('Only PDF and EPUB files are supported.')
      return
    }
    onUpload(file, { title: stripExtension(file.name), format })
  }

  return (
    <label className="cursor-pointer rounded bg-black px-4 py-2 text-sm text-white">
      Add book
      <input
        type="file" accept=".pdf,.epub" aria-label="Add book"
        className="hidden" onChange={onChange}
      />
    </label>
  )
}
```

- [ ] **Step 5: Implement LibraryPage**

Replace `src/pages/LibraryPage.tsx`:
```tsx
import { useCallback, useEffect, useState } from 'react'
import type { Book, BookFormat } from '../types'
import { listBooks, uploadBook, renameBook, deleteBook } from '../data/books'
import { BookCard } from '../components/BookCard'
import { UploadButton } from '../components/UploadButton'

export function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setBooks(await listBooks())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function handleUpload(file: File, meta: { title: string; format: BookFormat }) {
    await uploadBook(file, meta)
    await refresh()
  }
  async function handleRename(id: string, title: string) {
    await renameBook(id, title)
    await refresh()
  }
  async function handleDelete(id: string) {
    await deleteBook(id)
    await refresh()
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold">My library</h2>
        <UploadButton onUpload={handleUpload} />
      </div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : books.length === 0 ? (
        <p className="text-gray-500">No books yet — add your first PDF or EPUB.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => (
            <BookCard key={b.id} book={b} onRename={handleRename} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Run test — verify it passes**

Run: `npm test src/pages/LibraryPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the full suite + build**

Run: `npm test && npm run build`
Expected: all tests pass; clean build.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add library page with upload, grid, rename, and delete"
```

---

### Task 9: End-to-end verification of the vertical slice

**Files:**
- Create: `docs/guides/milestone-1-manual-test.md`

**Interfaces:**
- Consumes: a running app (`npm run dev`) + configured Supabase project.
- Produces: a written, repeatable manual acceptance check proving RLS isolation.

- [ ] **Step 1: Write the manual acceptance checklist**

Create `docs/guides/milestone-1-manual-test.md`:
```markdown
# Milestone 1 — manual acceptance

Prereq: `.env.local` set, migration applied (see supabase-setup.md), `npm run dev`.

1. Visit the app → you see the Log in page.
2. Sign up as user A (a@test.com / secret1). You land on an empty library.
3. Click **Add book**, pick a PDF → it appears with an inferred title.
4. Add an EPUB → it appears tagged EPUB.
5. Rename a book → title updates. Delete a book → it disappears.
6. Reload the page → books persist (they came from the database).
7. Log out. Sign up as user B (b@test.com / secret1) → library is EMPTY
   (does NOT show user A's books). This proves RLS isolation.
8. In Supabase Storage → `books` bucket, confirm files sit under
   `<userId>/...` folders.
```

- [ ] **Step 2: Execute the checklist against the running app**

Run: `npm run dev`, then follow every step in the checklist.
Expected: all 8 steps pass; step 7 in particular shows user B cannot see user A's books.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add milestone 1 manual acceptance checklist"
```

---

## Self-Review

**Spec coverage (M1 scope only):**
- Auth / sign-up / log-in → Tasks 4–6. ✓
- Private per-user library via RLS → Task 3 (policies) + Task 9 (proven). ✓
- Import PDF **and** EPUB → Tasks 7–8 (format inferred from extension). ✓
- Bookshelf grid with title/author/format, rename, delete → Task 8. ✓
- Repository pattern (no direct client use in UI) → Task 7 defines the boundary; Task 8 consumes only `src/data/books.ts`. ✓
- All four tables created up front → Task 3. ✓
- Reader, highlights, bookmarks, search, offline → **deferred to M2–M6 by design** (see roadmap), not gaps.

**Placeholder scan:** No TBDs; every code step contains full code; the Task-6 `LibraryPage` placeholder is explicitly replaced in Task 8. ✓

**Type consistency:** `Book`/`BookFormat` from `src/types.ts` used identically across Tasks 2, 7, 8. Repository signatures in Task 7's Interfaces block match the implementation and the Task 8 consumer (`uploadBook(file, {title, format})`, `renameBook(id, title)`, `deleteBook(id)`, `listBooks()`). ✓
