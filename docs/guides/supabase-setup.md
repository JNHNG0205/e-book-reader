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
