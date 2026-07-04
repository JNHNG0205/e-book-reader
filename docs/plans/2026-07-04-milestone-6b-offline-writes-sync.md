# Milestone 6b: Offline Writes + Background Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let a user create/edit **highlights, bookmarks, and reading progress while offline** (or during a flaky connection) without losing them or seeing errors. Writes apply instantly (optimistic), persist locally, and **sync to Supabase in the background on reconnect**. Reads are served from a local cache first so the reader works offline.

**Design decisions (deviations from spec, with rationale):**
- **Outbox pattern, NOT Legend-State.** The spec named Legend-State, but the data is single-owner, last-write-wins, tiny JSON — a full reactive-state framework is over-engineering. A small IndexedDB **outbox** (queue of pending mutations) + optimistic local cache achieves the same result, wraps the existing `@backend/data/*` repos instead of replacing them, and is fully unit-testable.
- **Client-generated UUIDs.** Every table's `id` is a `uuid` whose `gen_random_uuid()` default only applies when omitted, so offline-created rows use `crypto.randomUUID()`. Sync then is an **idempotent upsert** (highlights/bookmarks by `id`; progress by `user_id,book_id`) + delete-by-id — no temp-id→server-id reconciliation.
- **Build order = risk order.** Tasks 1–4 are self-contained, fully-tested infrastructure that does not touch the working readers. Task 5 wires it in. If the milestone is paused after any task, the app still works exactly as today.

**Un-verifiable-until-deploy note:** true reconnect sync can only be exercised against a live Supabase backend (see M7). Unit tests cover all logic with mocks; the end-to-end offline→reconnect→synced flow is a manual browser check after deploy.

**Tech Stack:** existing stack + `idb` (already installed) + `fake-indexeddb` (already installed, tests).

## Global Constraints

- Client generates `id` (`crypto.randomUUID()`) for offline-created highlights/bookmarks; sync = upsert by pk. Progress upserts by `(user_id, book_id)`.
- The offline layer needs the user id **offline** → use `supabase.auth.getSession()` (local, no network), NOT `getUser()` (network).
- Optimistic: a write updates the local cache + returns immediately; the network call happens via the outbox flush. A write must NEVER throw just because the network is down.
- Sync is last-write-wins and idempotent: replaying the outbox must be safe (upsert/delete). On flush failure, keep the op and retry later (on next `online` event / next flush) — never drop a pending write.
- When ONLINE, behavior is unchanged from today (writes still reach Supabase promptly; reads still reflect the server) — the offline layer is transparent.
- Folder split + alias imports; `vi.mock()` paths match imports. TypeScript strict, no `any`. Bun; **`bun run test`** (never `bun test`); full suite + `bun run build` green. Don't regress existing reader/library/highlights/bookmarks/search/offline-reading behavior.

---

### Task 1: Sync store (IndexedDB) — outbox + entity caches

**Files:** create `src/frontend/offline/syncStore.ts`, `src/frontend/offline/syncStore.test.ts`

**Types:**
```ts
export type Entity = 'highlight' | 'bookmark' | 'progress'
export interface OutboxOp {
  opId: string          // crypto.randomUUID
  entity: Entity
  kind: 'upsert' | 'delete'
  rowId: string         // pk (highlight/bookmark id) or `${bookId}` for progress
  bookId: string
  payload: Record<string, unknown> // the row to upsert (ignored for delete)
  ts: number            // client timestamp (caller-supplied; tests pass a fixed value)
}
```

**Interfaces (produces):** all async, IndexedDB via `idb` (reuse the existing `ebook-reader` DB, bump its version and add stores in `upgrade`):
- Outbox: `enqueueOp(op: OutboxOp)`, `allOps(): Promise<OutboxOp[]>` (FIFO by ts), `removeOp(opId)`.
- Entity cache (per book): `putCachedRows(entity, bookId, rows: CachedRow[])`, `getCachedRows(entity, bookId): Promise<CachedRow[]>`, `upsertCachedRow(entity, bookId, row)`, `removeCachedRow(entity, bookId, rowId)`. (`CachedRow = { id: string } & Record<string, unknown>`.)

- [ ] **Step 1: failing test** (`syncStore.test.ts`, `import 'fake-indexeddb/auto'`): enqueue→allOps FIFO→removeOp; put/get cached rows per book; upsert replaces by id; remove drops by id; caches are isolated per (entity, bookId).
- [ ] **Step 2: run — fails.**
- [ ] **Step 3: implement** with `idb`. Keys: outbox keyed by `opId`; entity caches keyed by `${entity}:${bookId}` storing an array (or a store per entity keyed by `[bookId,id]` — implementer's choice, keep it simple and covered by tests). Preserve the existing `books` store from bookCache (bump `openDB` version + additive `upgrade`). NOTE: bookCache.ts opens the same DB name at version 1 — coordinate: move the shared `openDB` (name `ebook-reader`, version 2, stores `books`+`outbox`+caches) into one module both import, OR have syncStore own version 2 and bookCache tolerate it. Verify bookCache tests still pass.
- [ ] **Step 4: run — passes.**
- [ ] **Step 5: full suite + build; commit** `feat: IndexedDB sync store (outbox + entity caches)`

---

### Task 2: Repo upserts + local user id

**Files:** modify `src/backend/data/highlights.ts`, `src/backend/data/bookmarks.ts`, `src/backend/data/currentUser.ts`; extend their tests.

**Interfaces (produces):**
- `currentUser.ts`: add `getUserIdLocal(): Promise<string | null>` using `supabase.auth.getSession()` (no network; returns `session.user.id` or null).
- `highlights.ts`: add `upsertHighlight(row: Highlight): Promise<void>` → `supabase.from('highlights').upsert(row)`. (Keep existing `saveHighlight`/`updateHighlight`/`deleteHighlight` for the online path / callers not yet migrated.)
- `bookmarks.ts`: add `upsertBookmark(row: Bookmark): Promise<void>` → `.upsert(row)`.
- (`progress.ts` already upserts by `user_id,book_id`; add nothing, but sync will call `saveProgress` — fine.)

- [ ] **Step 1: failing tests** — mock `@backend/supabase`; assert `upsertHighlight`/`upsertBookmark` call `.upsert` with the full row incl. `id`; `getUserIdLocal` returns the session user id and null when no session, without calling `getUser`.
- [ ] **Step 2–4: implement + pass.**
- [ ] **Step 5: full suite + build; commit** `feat: repo upserts + offline-safe local user id`

---

### Task 3: Sync engine

**Files:** create `src/frontend/offline/syncEngine.ts`, `syncEngine.test.ts`

**Interfaces (produces):**
- `flushOutbox(): Promise<{ synced: number; remaining: number }>` — reads `allOps()` in FIFO order; for each, dispatch by `entity`+`kind` to the repo (`upsertHighlight`/`deleteHighlight`/`upsertBookmark`/`deleteBookmark`/`saveProgress`); on success `removeOp`; on the FIRST failure, **stop** (leave it + the rest for a later flush) and return counts. Guard against concurrent flushes (a module-level in-flight flag).
- `startAutoSync(): () => void` — flush once now (best-effort, ignore errors), add a `window` `'online'` listener that flushes; returns an unsubscribe. 
- Optional `onSyncChange(cb)` for a status indicator (idle/syncing/pending count) — keep minimal.

- [ ] **Step 1: failing tests** — mock `./syncStore` (allOps/removeOp) + the repos; assert: ops dispatched to the right repo fn in order; op removed on success; a mid-queue failure stops and leaves the failed + subsequent ops; `startAutoSync` flushes on an `online` event; concurrent `flushOutbox` calls don't double-send.
- [ ] **Step 2–4: implement + pass.**
- [ ] **Step 5: full suite + build; commit** `feat: outbox sync engine (flush + auto-sync on reconnect)`

---

### Task 4: Offline data facade

**Files:** create `src/frontend/offline/offlineData.ts`, `offlineData.test.ts`

**Interfaces (produces)** — the API the readers call instead of the raw repos. Optimistic + cache-first + enqueue:
- `listHighlights(bookId): Promise<Highlight[]>` — return `getCachedRows('highlight', bookId)` immediately; if online, also fetch server `listHighlights`, overlay pending outbox ops (apply pending upserts, drop pending deletes), `putCachedRows`, and return the merged list. (Return the merged list when online; cached when offline.)
- `saveHighlight(bookId, fields): Promise<Highlight>` — build a full row: `id = crypto.randomUUID()`, `user_id = getUserIdLocal()`, `book_id`, fields, `created_at/updated_at = new Date().toISOString()`; `upsertCachedRow`; `enqueueOp({entity:'highlight', kind:'upsert', rowId:id, payload:row, ...})`; fire-and-forget `flushOutbox()` (ignore error); return the row.
- `updateHighlight(bookId, id, fields)`, `deleteHighlight(bookId, id)` — update/remove cached row + enqueue upsert/delete + flush.
- Same shape for bookmarks (`listBookmarks/saveBookmark/deleteBookmark`) and `getProgress(bookId)/saveProgress(bookId, location)` (progress cache is a single row per book; op `entity:'progress'`, `rowId:bookId`).
- Note `crypto.randomUUID`/`new Date()` are impure — inject or wrap so tests can assert (e.g. accept them via a small internal `now()`/`newId()` seam, or assert shape not exact values).

- [ ] **Step 1: failing tests** — mock `./syncStore`, `./syncEngine`, the repos, and `getUserIdLocal`; simulate online/offline via `navigator.onLine` (stub). Assert: offline `saveHighlight` still returns a row, writes cache, enqueues, and does NOT throw when the repo/flush would fail; `listHighlights` returns cache offline and merged (server + pending) online; delete enqueues a delete + removes from cache.
- [ ] **Step 2–4: implement + pass.**
- [ ] **Step 5: full suite + build; commit** `feat: offline data facade (optimistic writes + cache-first reads)`

---

### Task 5: Wire the readers to the offline facade

**Files:** modify `src/frontend/reader/EpubReader.tsx`, `src/frontend/pages/ReaderPage.tsx`, `src/main.tsx` (start auto-sync); update their tests.

**Behavior:**
- Replace the readers' imports of `@backend/data/highlights`/`bookmarks`/`progress` with `@frontend/offline/offlineData` (same function names/shapes, so call sites barely change — note `saveHighlight`/`saveBookmark`/`getProgress`/`saveProgress` now take/So use the facade signatures, which include `bookId` where needed).
- `src/main.tsx`: call `startAutoSync()` once on app start (so a reconnect flushes pending writes app-wide).
- Keep every existing reader test green; where a test mocked `@backend/data/*`, point it at `@frontend/offline/offlineData` instead (same fn names). Add one test per reader: an offline write (facade `saveHighlight` resolves a row even though the network would fail) still shows up in the UI.

- [ ] **Step 1: failing/updated tests.**
- [ ] **Step 2–4: implement + pass.**
- [ ] **Step 5: full suite + build; commit** `feat: readers use the offline data facade (offline writes + sync)`

---

## Self-Review

**Spec coverage (roadmap M6, offline-writes half):**
- Create/edit highlights, bookmarks, progress offline → Tasks 4–5 (optimistic + outbox). ✓
- Background sync + retry on reconnect → Task 3 (`flushOutbox` + `online` auto-sync, stop-and-retry on failure). ✓
- Last-write-wins, no reconciliation → client UUIDs + idempotent upsert/delete (Tasks 2–4). ✓
- Reads work offline → Task 4 cache-first. ✓
- (Legend-State replaced by an outbox — documented deviation with rationale.)

**Placeholder scan:** none; the only browser-runtime-only piece is the real reconnect sync (needs live backend — manual check after M7).

**Type consistency:** `Highlight`/`Bookmark` from `@shared/types` flow through cache, outbox `payload`, and repo upserts; `OutboxOp`/`Entity` shared by store + engine + facade.

**Test isolation:** IndexedDB via `fake-indexeddb/auto`; engine/facade with store + repos mocked; online/offline via stubbed `navigator.onLine` + `online` events. Manual post-deploy check: go offline → add a highlight/bookmark, turn a page → reload (still there, from cache) → reconnect → confirm the rows appear in Supabase and survive a hard refresh; conflicting edits on two "devices" resolve last-write-wins.
