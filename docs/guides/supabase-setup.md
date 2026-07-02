# Supabase setup

1. Create a project at https://supabase.com. From **Project Settings → API**, copy:
   - the **Project URL** — the bare origin `https://<ref>.supabase.co`
     (do **not** include a `/rest/v1` path — the client appends the right paths itself), and
   - the **publishable key** (starts with `sb_publishable_…`, the client-side key).
2. Put them in `.env.local`:
   ```
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   Note: Vite reads env only at startup — restart `bun run dev` after changing this file.
3. Apply the schema: open the project's **SQL Editor**, paste the contents of
   `supabase/migrations/0001_init.sql`, and Run. (Or use the Supabase CLI:
   `supabase db push`.)
4. Auth → Providers: ensure **Email** is enabled. For local dev, turn **off**
   "Confirm email" so signups log in immediately.
5. Verify: Table Editor shows `books`, `reading_progress`, `highlights`,
   `bookmarks`; Storage shows a private `books` bucket.
