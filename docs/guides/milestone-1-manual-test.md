# Milestone 1 — manual acceptance

Proves the Foundation works end-to-end, including per-user RLS isolation.

**Prereqs:**
- A Supabase project created and `supabase/migrations/0001_init.sql` applied (see
  [`supabase-setup.md`](./supabase-setup.md)).
- `.env.local` set with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Auth → Providers → Email enabled; for local testing turn **off** "Confirm email"
  so signups log in immediately.
- App running: `bun run dev`.

## Steps

1. Visit the app → you see the **Log in** page.
2. Sign up as **user A** (`a@test.com` / `secret1`). You land on an empty library.
3. Click **Add book**, pick a **PDF** → it appears with a title inferred from the
   filename and a `PDF` cover placeholder.
4. Add an **EPUB** → it appears tagged `EPUB`.
5. **Rename** a book → the title updates. **Delete** a book → it disappears.
6. **Reload** the page → remaining books persist (they came from the database).
7. **Log out** (header button). Sign up as **user B** (`b@test.com` / `secret1`) →
   the library is **EMPTY** — it does NOT show user A's books. *(This is the RLS
   isolation proof: the core Milestone 1 guarantee.)*
8. In Supabase → Storage → `books` bucket, confirm uploaded files live under
   `<userId>/...` folders (each user's files under their own id).

## Pass criteria

All 8 steps behave as described. Step 7 in particular must show that user B cannot
see user A's books — if user B sees any of user A's data, RLS is misconfigured and
this is a blocking failure.
