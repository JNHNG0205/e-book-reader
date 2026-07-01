# E-Book Reader — Implementation Roadmap

Companion to the spec: [`docs/specs/2026-07-01-ebook-reader-design.md`](../specs/2026-07-01-ebook-reader-design.md).

The build is split into milestones. **Each milestone is a self-contained plan that
produces working, testable software on its own** and is safe to stop at. Build them in
order; each assumes the previous is complete.

| # | Milestone | Ships | Plan file |
|---|---|---|---|
| 1 | **Foundation** | Sign up / log in, upload a PDF/EPUB, see it on your private shelf, rename/delete. Data isolated per user via RLS. | [`2026-07-01-milestone-1-foundation.md`](./2026-07-01-milestone-1-foundation.md) |
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

## Conventions used by every milestone plan

- **Testing:** Vitest + React Testing Library for units/components; Playwright for the
  few end-to-end flows (upload→open, RLS isolation). TDD: failing test first.
- **Repository pattern:** all persistence goes through `src/data/*.ts` modules. UI never
  calls the Supabase client directly.
- **Types live in `src/types.ts`** and are imported everywhere — single source of truth
  for `Book`, `Highlight`, `Bookmark`, `ReadingProgress`.
- **Commits:** small and frequent, one per task step group, conventional-commit
  messages.
