# Milestone 6a: PWA + Offline Reading — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app an **installable PWA** whose **app shell loads offline**, and let a user **re-read any book they've opened before while offline**. Opening a book downloads its bytes once and caches them in IndexedDB; later opens (including offline) serve from the cache. The library shows a cached list when offline and badges which books are available offline.

**Scope (M6a):** installability + offline *reading*. NOT in this milestone (deferred to **M6b**): offline *writes* (highlights/bookmarks/progress created offline), Legend-State local-first store, background sync. Online writes are unchanged.

**Architecture:** Book files come from Supabase Storage via short-lived **signed URLs** that change every session, so URL-based service-worker caching won't match across visits. Instead we cache **book bytes in IndexedDB keyed by `bookId`**, and the reader loads a book by resolving a **blob URL** from cached bytes (cache-first) — so both viewers and PDF search keep taking a URL and need no interface change. `vite-plugin-pwa` (Workbox) precaches the built app shell for offline load + installability.

**Tech Stack:** existing React 19 / Vite / TS / Tailwind / Supabase / Vitest, plus **`idb`** (tiny IndexedDB wrapper), **`vite-plugin-pwa`** (dev), **`fake-indexeddb`** (dev, for tests).

## Setup (before Task 1)

```bash
bun add idb
bun add -d vite-plugin-pwa fake-indexeddb
```

## Global Constraints

- Offline book reading works by caching **bytes in IndexedDB** keyed by `bookId`; the reader resolves a **blob URL** from those bytes. Do NOT rely on caching signed URLs (they rotate).
- Revoke every `URL.createObjectURL` blob URL when it's replaced or the reader unmounts (no leaks).
- If a book isn't cached AND the network is unavailable, the reader shows a clear "not available offline" message rather than hanging.
- The PWA service worker must NOT cache Supabase API/Storage/auth responses (those stay network-only / are handled by the IndexedDB layer) — only precache the built app shell + static assets.
- Folder split + alias imports; `vi.mock()` paths match import paths. TypeScript strict, no `any`. Bun; tests via **`bun run test`** (never `bun test`); full suite + `bun run build` green.
- Don't regress existing reader/library/highlights/bookmarks/search behavior.

---

### Task 1: Book byte cache (IndexedDB)

**Files:**
- Create: `src/frontend/offline/bookCache.ts`
- Test: `src/frontend/offline/bookCache.test.ts`

**Interfaces (produces):**
- `putCachedBook(bookId: string, bytes: ArrayBuffer): Promise<void>`
- `getCachedBook(bookId: string): Promise<ArrayBuffer | null>`
- `hasCachedBook(bookId: string): Promise<boolean>`
- `deleteCachedBook(bookId: string): Promise<void>`
- `cachedBookIds(): Promise<string[]>` — for the library's "offline available" badges.

- [ ] **Step 1: Write the failing test**

Create `src/frontend/offline/bookCache.test.ts`:
```ts
import 'fake-indexeddb/auto'
import { beforeEach, expect, test } from 'vitest'
import { putCachedBook, getCachedBook, hasCachedBook, deleteCachedBook, cachedBookIds } from './bookCache'

function bytes(str: string): ArrayBuffer {
  return new TextEncoder().encode(str).buffer
}

beforeEach(async () => {
  for (const id of await cachedBookIds()) await deleteCachedBook(id)
})

test('stores and reads back book bytes', async () => {
  await putCachedBook('b1', bytes('hello'))
  const got = await getCachedBook('b1')
  expect(got).not.toBeNull()
  expect(new TextDecoder().decode(new Uint8Array(got!))).toBe('hello')
})

test('reports presence and lists ids', async () => {
  expect(await hasCachedBook('b1')).toBe(false)
  await putCachedBook('b1', bytes('x'))
  await putCachedBook('b2', bytes('y'))
  expect(await hasCachedBook('b1')).toBe(true)
  expect((await cachedBookIds()).sort()).toEqual(['b1', 'b2'])
})

test('getCachedBook returns null for a miss', async () => {
  expect(await getCachedBook('nope')).toBeNull()
})

test('deletes a cached book', async () => {
  await putCachedBook('b1', bytes('x'))
  await deleteCachedBook('b1')
  expect(await hasCachedBook('b1')).toBe(false)
})
```

- [ ] **Step 2: Run — verify it fails.** `bun run test src/frontend/offline/bookCache.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

Create `src/frontend/offline/bookCache.ts`:
```ts
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'ebook-reader'
const STORE = 'books' // key: bookId -> value: ArrayBuffer

let dbPromise: Promise<IDBPDatabase> | null = null
function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
    },
  })
  return dbPromise
}

export async function putCachedBook(bookId: string, bytes: ArrayBuffer): Promise<void> {
  await (await db()).put(STORE, bytes, bookId)
}

export async function getCachedBook(bookId: string): Promise<ArrayBuffer | null> {
  const v = await (await db()).get(STORE, bookId)
  return (v as ArrayBuffer | undefined) ?? null
}

export async function hasCachedBook(bookId: string): Promise<boolean> {
  return (await (await db()).getKey(STORE, bookId)) !== undefined
}

export async function deleteCachedBook(bookId: string): Promise<void> {
  await (await db()).delete(STORE, bookId)
}

export async function cachedBookIds(): Promise<string[]> {
  return (await (await db()).getAllKeys(STORE)) as string[]
}
```

- [ ] **Step 4: Run — verify pass.** `bun run test src/frontend/offline/bookCache.test.ts` → PASS (4 tests).

- [ ] **Step 5: Full suite + build; commit.** `bun run test && bun run build` green. `git commit -m "feat: IndexedDB book-byte cache for offline reading"`

---

### Task 2: Cache-first book loading (offline reading) in ReaderPage

**Files:**
- Create: `src/frontend/offline/loadBook.ts`
- Test: `src/frontend/offline/loadBook.test.ts`
- Modify: `src/frontend/pages/ReaderPage.tsx`
- Test: `src/frontend/pages/ReaderPage.test.tsx`

**Interfaces:**
- `loadBookObjectUrl(bookId, storagePath, format): Promise<string>` — returns a **blob** object URL for the book:
  1. `getCachedBook(bookId)` → if present, `URL.createObjectURL(new Blob([bytes], { type: mimeFor(format) }))`.
  2. else `getBookFileUrl(storagePath)` → `fetch` → `arrayBuffer()` → `putCachedBook(bookId, bytes)` → blob URL.
  (`mimeFor`: pdf → `application/pdf`, epub → `application/epub+zip`.)
- `ReaderPage` calls it instead of `getBookFileUrl` directly, stores the returned URL, **revokes** it on cleanup/replacement, and shows an offline-unavailable error if it throws while offline.

- [ ] **Step 1: Write failing tests**

Create `src/frontend/offline/loadBook.test.ts` — mock `@backend/data/books` (`getBookFileUrl`) and `./bookCache`. Assert:
- cache hit → returns a `blob:`/object URL and does NOT call `getBookFileUrl`;
- cache miss → calls `getBookFileUrl`, fetches (stub `global.fetch` → `{ arrayBuffer: async () => buf }`), calls `putCachedBook`, returns an object URL.
(Stub `URL.createObjectURL` to return a sentinel like `'blob:x'`.)

In `ReaderPage.test.tsx`, update the existing mock: the page previously mocked `getBookFileUrl`; now mock `@frontend/offline/loadBook`'s `loadBookObjectUrl` to resolve a fake URL so the existing PDF/EPUB render tests still pass. Add one test: when `loadBookObjectUrl` rejects, the page shows an offline/error message (not a permanent "Loading…").

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement**

Create `src/frontend/offline/loadBook.ts`:
```ts
import { getBookFileUrl } from '@backend/data/books'
import { getCachedBook, putCachedBook } from './bookCache'
import type { BookFormat } from '@shared/types'

function mimeFor(format: BookFormat): string {
  return format === 'pdf' ? 'application/pdf' : 'application/epub+zip'
}

// Resolves a book to a local blob URL, caching its bytes on first (online) open so later
// opens — including offline — work from IndexedDB. Callers must revokeObjectURL when done.
export async function loadBookObjectUrl(
  bookId: string,
  storagePath: string,
  format: BookFormat,
): Promise<string> {
  const cached = await getCachedBook(bookId)
  if (cached) return URL.createObjectURL(new Blob([cached], { type: mimeFor(format) }))

  const url = await getBookFileUrl(storagePath)
  const bytes = await (await fetch(url)).arrayBuffer()
  await putCachedBook(bookId, bytes).catch(() => { /* cache is best-effort */ })
  return URL.createObjectURL(new Blob([bytes], { type: mimeFor(format) }))
}
```

In `ReaderPage.tsx`, replace the file-url resolution (currently `setFileUrl(await getBookFileUrl(b.storage_path))`) with:
```ts
try {
  const objectUrl = await loadBookObjectUrl(b.id, b.storage_path, b.format)
  setFileUrl(objectUrl)
} catch {
  setError('This book isn’t available offline. Reconnect to open it the first time.')
}
```
Revoke on cleanup: track the object URL in a ref and `URL.revokeObjectURL(...)` in the effect's cleanup (and when the book changes). Keep the existing `error` rendering path.

- [ ] **Step 4: Run — verify pass.** Both files green.

- [ ] **Step 5: Full suite + build; commit.** `bun run test && bun run build` green. `git commit -m "feat: cache-first book loading via blob URL (offline reading)"`

---

### Task 3: Installable PWA + offline app shell

**Files:**
- Modify: `vite.config.ts`
- Create: `public/app-icon.svg` (a simple book glyph, no text)
- Modify: `index.html` (theme-color meta if not present)
- Modify: `src/main.tsx` (register the service worker via the virtual module)
- Test: none meaningful in jsdom (SW/manifest are build/runtime) — verify via build output + manual browser check.

**Interfaces / behavior:**
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`, a Workbox config that **precaches the built app shell** (JS/CSS/HTML/icon) and uses `navigateFallback` so a cold offline load still boots the SPA.
- A web manifest: `name`, `short_name`, `theme_color`, `background_color`, `display: 'standalone'`, `start_url: '/'`, and icons pointing at `app-icon.svg` (sizes `any`, plus a maskable entry).
- **Do not** let Workbox cache Supabase requests — restrict `globPatterns` to built assets and add a `runtimeCaching`/`navigateFallbackDenylist` that excludes `*.supabase.co` and `/rest`, `/storage`, `/auth` paths (those must hit network; offline books come from IndexedDB, not the SW).

- [ ] **Step 1: Add the icon + config**

Create `public/app-icon.svg` — a minimal book icon (rounded rect + pages), `fill`/`stroke` with a solid brand color on a contrasting background so it reads at small sizes.

In `vite.config.ts`, add `VitePWA({...})` to `plugins` (import from `vite-plugin-pwa`):
```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['app-icon.svg'],
  manifest: {
    name: 'E-Book Reader',
    short_name: 'Reader',
    description: 'Read your PDF and EPUB library, online or offline.',
    theme_color: '#111111',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: 'app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,svg,woff2}'],
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/(rest|storage|auth|functions)\//, /supabase\.co/],
  },
  devOptions: { enabled: false },
})
```

- [ ] **Step 2: Register the SW**

In `src/main.tsx`, register via the virtual module (guard so tests/SSR don't choke):
```ts
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })
```
Add `vite-plugin-pwa/client` (or `/// <reference types="vite-plugin-pwa/client" />`) to the app's TS types so `virtual:pwa-register` resolves. If the Vitest/jsdom setup errors on the virtual import, guard the registration behind `import.meta.env.PROD` or move it into a `if ('serviceWorker' in navigator)` block that tests don't execute.

- [ ] **Step 3: Verify build emits SW + manifest**

Run: `bun run build`. Confirm `dist/` contains `sw.js` (or `service-worker.js`), `manifest.webmanifest`, and `workbox-*.js`. Run `bun run test` — full suite still green (the virtual import must not break jsdom tests; adjust the guard in Step 2 if it does).

- [ ] **Step 4: Commit.** `git commit -m "feat: installable PWA with offline app-shell (vite-plugin-pwa)"`

---

### Task 4: Library offline fallback + "Available offline" badge

**Files:**
- Modify: `src/frontend/pages/LibraryPage.tsx`
- Modify: `src/frontend/components/BookCard.tsx`
- Test: extend `LibraryPage.test.tsx` + `BookCard.test.tsx`

**Interfaces / behavior:**
- On a successful `listBooks()`, cache the list JSON in `localStorage` (`library.books`). If `listBooks()` throws (offline), fall back to the cached list (read-only) so the user can still reach their books. Surface a subtle "Offline — showing your saved library" note when using the fallback.
- Fetch `cachedBookIds()` once and pass an `offlineAvailable` boolean to each `BookCard`; render a small **"Offline"** badge (SVG check/download icon + label, per the SVG-icon preference) on books whose bytes are cached. Offline, only offline-available books should open successfully (others show the reader's offline-unavailable message from Task 2).

- [ ] **Step 1: Write failing tests**

- `BookCard.test.tsx`: renders an "Offline" badge when `offlineAvailable` is true, and not when false.
- `LibraryPage.test.tsx`: when `listBooks` rejects but `localStorage['library.books']` has a saved list, the page renders those books + the offline note; badges reflect `cachedBookIds()` (mock `@frontend/offline/bookCache`).

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Implement** the localStorage list cache + fallback in `LibraryPage`, the `cachedBookIds()` lookup → `offlineAvailable` prop, and the badge in `BookCard` (SVG icon + "Offline" label).

- [ ] **Step 4: Run — verify pass; full suite + build green.**

- [ ] **Step 5: Commit.** `git commit -m "feat: offline library fallback + available-offline badge"`

---

## Self-Review

**Spec coverage (roadmap M6, offline-reading half):**
- Installable PWA (home-screen/standalone) → Task 3. ✓
- App shell loads offline → Task 3 (Workbox precache + navigateFallback). ✓
- Opened books cached for offline re-reading → Task 1 (IndexedDB) + Task 2 (cache-first blob-URL load). ✓
- Reachable offline (library shows cached books, badges offline ones) → Task 4. ✓
- Deferred to M6b (per the scoping decision): offline writes, Legend-State local store, background sync. Explicitly OUT.

**Placeholder scan:** the only browser-runtime piece not unit-tested is the service worker itself (Task 3), flagged for the manual browser check.

**Type consistency:** `bookCache` works in `ArrayBuffer`; `loadBookObjectUrl` returns a `string` URL consumed unchanged by `EpubReader`/`PdfViewer`/`searchPdf`; `BookFormat` from `@shared/types` drives the blob MIME type.

**Test isolation:** IndexedDB via `fake-indexeddb/auto`; `loadBook` with `bookCache` + `getBookFileUrl` + `fetch` mocked; `ReaderPage`/`LibraryPage` with the offline modules mocked. The SW + install prompt + true offline behavior are verified in the manual browser check: build + preview → install the app → open a book online (caches it) → go offline (DevTools) → reload → app shell boots, the opened book still reads, the library shows it badged "Offline," and an un-opened book shows the offline-unavailable message.
