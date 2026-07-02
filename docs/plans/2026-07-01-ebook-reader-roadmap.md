# E-Book Reader — Implementation Roadmap

Companion to the spec: [`docs/specs/2026-07-01-ebook-reader-design.md`](../specs/2026-07-01-ebook-reader-design.md).

The build is split into milestones. **Each milestone is a self-contained plan that
produces working, testable software on its own** and is safe to stop at. Build them in
order; each assumes the previous is complete.

| # | Milestone | Ships | Plan file |
|---|---|---|---|
| 1 | **Foundation** | Sign up / log in, upload a PDF/EPUB, see it on your private shelf, rename/delete. Data isolated per user via RLS. | [`2026-07-01-milestone-1-foundation.md`](./2026-07-01-milestone-1-foundation.md) |
| 1.5 | **Signup confirmation UX** | After signup with email confirmation on, show an inline "check your email" state (address + resend + back-to-login); `emailRedirectTo` so the link logs them back in. | inline brief (`.superpowers/sdd/task-m1.5-brief.md`) |
| 2 | **PDF reader** | Open a PDF, exact-page render, page nav, zoom, progress + resume. | _written after M1_ |
| 3 | **EPUB reader** | Open an EPUB, reflowable render, font/theme + dark mode, TOC, progress + resume. Shared reader chrome unified with M2. | _written after M2_ |
| 4 | **Highlights + bookmarks** | Highlight pen (preset colors) over text, notes, highlights panel, bookmarks. Unified across both formats. | _written after M3_ |
| 5 | **In-book search** | Search within the open book for both formats. | _written after M4_ |
| 6 | **Offline-first + PWA** | Installable PWA, offline book caching, local-first store (Legend-State) with background sync + last-write-wins. | _written after M4_ |
| 7 | **Deploy** | Vercel + Supabase production config, migrations checked in, smoke test. | _written after M6_ |

## Sequencing notes

- **M6 (offline/sync) comes late on purpose.** We build the data-access layer in M1–M4
  behind a small repository interface so that swapping "direct Supabase calls" for
  "Legend-State local-first store" in M6 is an internal change, not a rewrite. Each
  repository module exposes plain async functions (`listBooks()`, `saveHighlight()`,
  etc.); M6 re-implements them against the local store.
- **M2 and M3 share reader chrome** (toolbar, progress bar, side panel shell). M2
  builds it minimally; M3 generalizes it so both renderers plug in. The highlight/
  bookmark UI (M4) mounts into that shared shell.
- Stop points are real: after M1 you have a working (online-only) library; after M5 a
  full-featured online reader; M6 adds offline.

## Folder structure (frontend / backend / shared)

The app is split into clear layers with path aliases (configured in `vite.config.ts`
and `tsconfig.app.json`):

```
src/
  main.tsx, index.css, test/setup.ts   # app bootstrap (stay at src root)
  frontend/    # all UI — components/, pages/, auth/   → alias @frontend
  backend/     # data/server-side — supabase.ts, data/ (repositories)  → alias @backend
  shared/      # types.ts (domain types used by both)  → alias @shared
supabase/migrations/                    # SQL schema + RLS
```

- **Import across layers via the alias** (`@backend/data/books`, `@shared/types`,
  `@frontend/auth/useSession`); relative imports are fine within the same folder.
- **Test mocks must use the same alias path** as the import
  (`vi.mock('@backend/data/books', …)`), or the mock silently won't apply.
- New backend data-access lives in `src/backend/data/*` (one repository per domain:
  `books.ts`, later `highlights.ts`, `bookmarks.ts`, `progress.ts`). New UI lives under
  `src/frontend/*`. Shared types go in `src/shared/types.ts`.

## Conventions used by every milestone plan

- **Package manager / runtime:** Bun. Install with `bun add`, run scripts with
  `bun run <script>`. Run tests as **`bun run test`** (invokes Vitest) — never `bun test`,
  which is Bun's own unrelated test runner.
- **Testing:** Vitest + React Testing Library for units/components; Playwright for the
  few end-to-end flows (upload→open, RLS isolation). TDD: failing test first.
- **Repository pattern:** all persistence goes through `src/data/*.ts` modules. UI never
  calls the Supabase client directly.
- **Types live in `src/types.ts`** and are imported everywhere — single source of truth
  for `Book`, `Highlight`, `Bookmark`, `ReadingProgress`.
- **Commits:** small and frequent, one per task step group, conventional-commit
  messages.
