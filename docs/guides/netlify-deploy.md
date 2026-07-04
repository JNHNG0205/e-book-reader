# Deploy guide — Netlify + Supabase (Milestone 7)

Takes the app from local to a public URL your friend can sign up on. The code side is done
(`netlify.toml` handles build + SPA routing + PWA headers; the migration handles all
security). What's left is account/dashboard work in **Supabase** and **Netlify** — those you
do yourself; this guide is the exact steps.

**Security note:** the two `VITE_SUPABASE_*` values are embedded in the browser bundle on
purpose and are safe to expose — the publishable key grants nothing on its own; Row-Level
Security (RLS) enforces "each user sees only their own rows." **Never** put a Supabase
`service_role` key in a `VITE_` var or in Netlify env — it bypasses RLS.

---

## Part A — Supabase production project

1. **Create a project** at https://supabase.com (new project, pick a region near you, set a DB password).
2. **Apply the schema.** Open **SQL Editor → New query** and run each file in
   `supabase/migrations/` **in order**: `0001_init.sql` (tables + RLS policies + the private
   `books` Storage bucket + per-user object policies), then `0002_progress_percent.sql`
   (adds the library completion-percent column). Run any later-numbered migrations too.
3. **Verify security (do not skip — RLS *is* the protection):**
   - **Table Editor** → each of `books`, `reading_progress`, `highlights`, `bookmarks` shows
     a shield / "RLS enabled." (Authentication → Policies lists four `own_*` policies each.)
   - **Storage** → a bucket named `books` marked **Private** (not public).
   - Quick check: **Authentication → Policies** and **Storage → Policies** both show the
     `own_*` rules keyed on `auth.uid()`.
4. **Get the client credentials.** Project **Settings → API**:
   - **Project URL** → this is `VITE_SUPABASE_URL` (bare origin, e.g. `https://abcd.supabase.co`,
     with **no** `/rest/v1` path).
   - **Publishable key** (`sb_publishable_…`, the client key) → this is `VITE_SUPABASE_PUBLISHABLE_KEY`.
     (Do **not** use the `service_role`/secret key.)

## Part B — Netlify site

1. **Connect the repo.** Netlify → **Add new site → Import from Git** → pick this repo.
2. **Build settings** (these come from `netlify.toml`, but confirm):
   - Build command: `bun run build`
   - Publish directory: `dist`
   - Netlify auto-detects Bun from `bun.lock`. If the build can't find Bun, add an env var
     `BUN_VERSION = 1.3.5` (or your local `bun --version`).
3. **Environment variables** — Site configuration → **Environment variables** → add:
   - `VITE_SUPABASE_URL` = your Project URL from A.4
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = your publishable key from A.4
   (Vite inlines these at build time, so a redeploy is needed after changing them.)
4. **Deploy.** Trigger a deploy; note the site URL (e.g. `https://your-app.netlify.app`).

## Part C — Point Supabase Auth at the deployed URL

Email signup/login redirects fail if Supabase doesn't know the site. In Supabase →
**Authentication → URL Configuration**:
- **Site URL** = your Netlify URL (`https://your-app.netlify.app`).
- **Redirect URLs** → add `https://your-app.netlify.app/**` (and keep `http://localhost:5173/**`
  for local dev if you want).

(If you don't want to deal with email confirmation while testing, Authentication → Providers →
Email lets you toggle "Confirm email" off — but leave it on for real use.)

## Part D — Smoke test on the live URL

Run through the full app against production:
1. **Sign up** with a fresh email → confirm (check inbox) → land in the library.
2. **Upload** a PDF and an EPUB → covers + titles appear.
3. **Open** each → pages/text render; **nav/zoom** (PDF) and **font/theme/TOC** (EPUB) work.
4. **Bookmark** a spot, **highlight** some text (recolor / note / remove), **search** for a word → jump.
5. **Reload** → reading position, bookmarks, highlights all persist.
6. **Second account:** sign up as a different user → confirm the library is **empty** (RLS isolation — the most important check).
7. **PWA / offline (from M6a):** install the app (address-bar install icon) → open a book (caches it)
   → DevTools **Network → Offline** → reload → app shell boots, the book still **reads + searches**,
   the library shows it badged **"Offline"**, and an un-opened book shows "not available offline."

## Troubleshooting
- **Blank page / 404 on refresh of `/read/...`** → the SPA redirect isn't active; confirm
  `netlify.toml` deployed (or add a `public/_redirects` with `/*  /index.html  200`).
- **"Failed to fetch" on login/signup** → wrong `VITE_SUPABASE_URL` (has a path) or the key is
  the wrong one; and check Part C redirect URLs.
- **Can see another user's books** → RLS not enabled; re-run the migration and re-verify A.3.
- **Env change didn't take effect** → Vite bakes env at build; trigger a fresh Netlify deploy.
