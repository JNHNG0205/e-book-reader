# E-Book Reader — Design Spec

**Date:** 2026-07-01
**Status:** Approved design, ready for implementation planning

## 1. Summary

A hosted web application for reading PDF and EPUB books. It is deployed once; each
user signs up and gets their own **private, isolated library** — there is no shared
content between users. The app is an installable, **offline-first PWA**: books and all
user data are available and editable without a connection and sync automatically when
online.

Core capabilities: import PDF/EPUB, read with a faithful/adjustable viewer, highlight
text with a pen tool, take notes, bookmark locations, and resume reading across
devices.

## 2. Goals & Non-Goals

### Goals
- One deployed web app serving multiple users, each with a private library.
- Import and store **PDF and EPUB** files.
- **Exact-page** PDF rendering (pixel-perfect) and **reflowable** EPUB rendering.
- Common e-reader UX: TOC, page navigation, progress, zoom (PDF), font/theme + dark
  mode (EPUB), in-book search, resume-where-you-left-off.
- **Highlight pen** — pick a preset color, drag across text to highlight; edit color,
  attach a note, or delete. Unified highlights panel filterable by color.
- **Bookmarks** — mark and jump to locations.
- **Full offline-first**: installable PWA; read cached books offline; create/edit
  highlights, bookmarks, and progress offline with background sync on reconnect.

### Non-Goals (v1)
- Sharing books or libraries between users (each library is fully private).
- Social features, comments, or collaboration.
- Cross-book / global full-text search across the whole library.
- Freehand (non-text) drawing annotations.
- Native mobile/desktop apps (the PWA covers app-like install).

## 3. Users & Scale

- Audience: the author plus a few friends — small number of users, personal use.
- Design bias: lean on a managed backend (Supabase) so effort goes into features, not
  infrastructure. No need for CDN tuning, autoscaling, or heavy quota systems in v1.
- Single-user data ownership means data **conflicts are rare** (only the same user on
  two offline devices), which keeps the sync strategy simple.

## 4. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework / build | **React + Vite + TypeScript** | Fast dev, strong PDF/EPUB ecosystem |
| Styling | **Tailwind CSS** | Rapid, consistent reader UI |
| PDF rendering | **PDF.js** (via `react-pdf`) | Pixel-exact pages + text layer for selection/highlight |
| EPUB rendering | **epub.js** (via `react-reader`) | Standard reflowable renderer with CFI locations |
| Local-first data + sync | **Legend-State** + Supabase sync plugin | Local persistence, offline write queue, retry, last-write-wins |
| Backend (BaaS) | **Supabase** — Postgres + Auth + Storage + Row-Level Security | Auth, DB, file storage, per-user isolation with minimal server code |
| Offline / PWA | **`vite-plugin-pwa`** (Workbox) + Cache API / IndexedDB | Installable app, app-shell + book-file caching |
| UI data cache (light) | **TanStack Query** (reduced role) | For any non-synced/remote reads not owned by Legend-State |
| Hosting | **Vercel** (frontend) + Supabase (backend) | Free-tier friendly, git-push deploy |

**Alternative considered:** PowerSync + Supabase (SQLite-in-browser sync engine) — more
robust and battle-tested, but heavier setup than this scale needs. Chosen against for
v1; revisit if data volume or conflict complexity grows.

## 5. Architecture

```
Browser (React / Vite PWA)
 ├─ Service Worker (Workbox) ── caches app shell + book files (Cache API / IndexedDB)
 ├─ Auth (Supabase)
 ├─ Legend-State store ──────── local-first: books meta, highlights, bookmarks, progress
 │        ▲  bidirectional background sync (last-write-wins on updated_at)
 │        ▼
 │   Supabase Postgres (RLS: user sees only their own rows)
 ├─ Library view  ── reads book metadata from local store
 ├─ Upload        ── file → Supabase Storage (bucket: books/, RLS per-owner)
 └─ Reader
     ├─ PDF  → PDF.js renders page canvas + text layer
     ├─ EPUB → epub.js renders + reports CFI location
     ├─ Highlight pen → writes highlight row (color + anchor) to local store
     ├─ Bookmarks     → writes bookmark row to local store
     └─ Progress      → writes reading_progress row to local store
```

**Two offline problems, handled separately:**
1. **Book files (large binaries):** cached locally via the service worker / Cache API /
   IndexedDB when a book is opened or explicitly "made available offline."
2. **Row data (metadata, highlights, bookmarks, progress):** held in the Legend-State
   local store and synced to Postgres in the background.

## 6. Data Model (Postgres, protected by Row-Level Security)

All tables carry `user_id` (owner). RLS policy: a row is readable/writable only when
`user_id = auth.uid()`. Every table has `updated_at` for last-write-wins sync.

- **books** — `id, user_id, title, author, format('pdf'|'epub'), storage_path,
  cover_path, total_pages, created_at, updated_at`
- **reading_progress** — `id, user_id, book_id, location, updated_at`
  - `location`: PDF = page number; EPUB = CFI string.
- **highlights** — `id, user_id, book_id, color, note, anchor, created_at, updated_at`
  - `anchor` (JSON): PDF = `{ page, rects[], text }`; EPUB = `{ cfiRange, text }`.
- **bookmarks** — `id, user_id, book_id, location, label, created_at, updated_at`
  - `location`: PDF page number or EPUB CFI string.

**Storage:** bucket `books/` holds the uploaded PDF/EPUB files (and cover images), with
RLS so each file is accessible only by its owner.

## 7. Key Design Decisions

- **One highlight system, two anchor strategies.** The `highlights` table is
  format-agnostic; only the `anchor` JSON differs (pixel rects + page for PDF, CFI
  range for EPUB). Keeps the highlights UI/panel unified while each renderer handles
  its own anchoring. The "highlight pen" is the *creation UX* over this one engine — no
  separate data structure.
- **Per-user isolation via RLS**, not application code. "Everyone has their own
  library" is enforced at the database layer; the client cannot read others' rows.
- **Last-write-wins conflict resolution**, keyed per-row on `updated_at`. Acceptable
  because data is single-owner; the only conflict source is one user on two offline
  devices. No merge engine required.
- **PWA is required by offline-first**, not a nice-to-have. The service worker is the
  mechanism for offline book caching; installability is a free UX bonus on top.

## 8. Feature Breakdown

### Library
- Email-based auth (magic link or email/password — finalized in planning).
- Import PDF/EPUB (upload to Storage; extract title/author/cover/page count where
  possible).
- Bookshelf grid: cover, title, author. Rename / delete. "Continue reading" resume.

### Reader
- PDF: exact-page render, zoom, page navigation, progress.
- EPUB: reflowable render, font size, theme + dark mode, progress.
- Shared: table of contents, in-book search, auto-saved reading position.

### Highlights
- Pen tool with preset palette (yellow / green / pink / blue).
- Drag across text → highlight snapped to text layer (PDF rects / EPUB CFI).
- Tap highlight → change color, add/edit note, delete.
- Highlights & notes panel: list per book, filter by color, click to jump.

### Bookmarks
- Toggle bookmark at current location; optional label.
- Bookmarks list in side panel; click to jump.

### Offline / PWA
- Installable (home screen / desktop icon, standalone window).
- Opened books cached for offline re-reading; optional explicit "make available
  offline."
- Offline creation/edit of highlights, bookmarks, progress; background sync + retry on
  reconnect (last-write-wins).

## 9. Testing Strategy

- **Unit:** anchor serialization/deserialization for both PDF and EPUB highlights;
  last-write-wins merge logic; location (page / CFI) round-tripping.
- **Component:** reader controls, highlight pen interaction, highlights/bookmarks
  panels.
- **Integration:** upload → store → open → render for both formats; RLS policies (a
  user cannot read another user's rows/files).
- **Offline:** service-worker caching of app shell + a book file; create highlight
  offline → reconnect → verify sync; conflicting edits on two "devices" resolve by
  last-write-wins.

## 10. Deployment

- Frontend: Vercel (git-push deploy).
- Backend: Supabase project (Postgres + Auth + Storage), free tier for current scale.
- Migrations: SQL schema + RLS policies checked into the repo.
