import {
  getCachedRows,
  putCachedRows,
  upsertCachedRow,
  removeCachedRow,
  enqueueOp,
  allOps,
  type CachedRow,
  type Entity,
  type OutboxOp,
} from './syncStore'
import { flushOutbox } from './syncEngine'
import { listHighlights as listHighlightsRemote } from '@backend/data/highlights'
import { listBookmarks as listBookmarksRemote } from '@backend/data/bookmarks'
import { getProgress as getProgressRemote } from '@backend/data/progress'
import { getUserIdLocal } from '@backend/data/currentUser'
import type { Highlight, Bookmark } from '@shared/types'

// ---- Impurity seam (kept tiny so tests can assert shape rather than exact values) ----

function newId(): string {
  return crypto.randomUUID()
}

function now(): string {
  return new Date().toISOString()
}

function isOnline(): boolean {
  return navigator.onLine
}

// ---- Merge helper shared by all cache-first list reads ----

/**
 * Overlays pending outbox ops for (entity, bookId) onto a server row set:
 * pending upserts add/replace by id, pending deletes drop the id.
 */
async function overlayPending(entity: Entity, bookId: string, serverRows: CachedRow[]): Promise<CachedRow[]> {
  const ops = await allOps()
  const relevant = ops.filter((op) => op.entity === entity && op.bookId === bookId)

  const byId = new Map<string, CachedRow>()
  for (const row of serverRows) byId.set(row.id, row)

  for (const op of relevant) {
    if (op.kind === 'upsert') {
      byId.set(op.rowId, op.payload as CachedRow)
    } else {
      byId.delete(op.rowId)
    }
  }

  return Array.from(byId.values())
}

async function listCacheFirst<T>(
  entity: Entity,
  bookId: string,
  fetchRemote: () => Promise<T[]>,
): Promise<T[]> {
  const cached = await getCachedRows(entity, bookId)

  if (!isOnline()) {
    return cached as unknown as T[]
  }

  try {
    const server = (await fetchRemote()) as unknown as CachedRow[]
    const merged = await overlayPending(entity, bookId, server)
    await putCachedRows(entity, bookId, merged)
    return merged as unknown as T[]
  } catch {
    return cached as unknown as T[]
  }
}

function enqueueAndFlush(op: OutboxOp): void {
  void enqueueOp(op).then(() => flushOutbox().catch(() => {}))
}

// ---- Highlights ----

export async function listHighlights(bookId: string): Promise<Highlight[]> {
  return listCacheFirst<Highlight>('highlight', bookId, () => listHighlightsRemote(bookId))
}

export async function saveHighlight(
  bookId: string,
  fields: { color: string; note?: string | null; anchor: Record<string, unknown> },
): Promise<Highlight> {
  const userId = (await getUserIdLocal()) ?? ''
  const timestamp = now()
  const row: Highlight = {
    id: newId(),
    user_id: userId,
    book_id: bookId,
    color: fields.color,
    note: fields.note ?? null,
    anchor: fields.anchor,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await upsertCachedRow('highlight', bookId, row as unknown as CachedRow)
  enqueueAndFlush({
    opId: newId(),
    entity: 'highlight',
    kind: 'upsert',
    rowId: row.id,
    bookId,
    payload: row as unknown as Record<string, unknown>,
    ts: Date.now(),
  })

  return row
}

export async function updateHighlight(
  bookId: string,
  id: string,
  fields: { color?: string; note?: string | null },
): Promise<void> {
  const cached = await getCachedRows('highlight', bookId)
  const existing = cached.find((row) => row.id === id)
  const merged: CachedRow = {
    ...(existing ?? { id, book_id: bookId }),
    ...fields,
    updated_at: now(),
  }

  await upsertCachedRow('highlight', bookId, merged)
  enqueueAndFlush({
    opId: newId(),
    entity: 'highlight',
    kind: 'upsert',
    rowId: id,
    bookId,
    payload: merged,
    ts: Date.now(),
  })
}

export async function deleteHighlight(bookId: string, id: string): Promise<void> {
  await removeCachedRow('highlight', bookId, id)
  enqueueAndFlush({
    opId: newId(),
    entity: 'highlight',
    kind: 'delete',
    rowId: id,
    bookId,
    payload: {},
    ts: Date.now(),
  })
}

// ---- Bookmarks ----

export async function listBookmarks(bookId: string): Promise<Bookmark[]> {
  return listCacheFirst<Bookmark>('bookmark', bookId, () => listBookmarksRemote(bookId))
}

export async function saveBookmark(
  bookId: string,
  fields: { location: string; label?: string | null },
): Promise<Bookmark> {
  const userId = (await getUserIdLocal()) ?? ''
  const timestamp = now()
  const row: Bookmark = {
    id: newId(),
    user_id: userId,
    book_id: bookId,
    location: fields.location,
    label: fields.label ?? null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  await upsertCachedRow('bookmark', bookId, row as unknown as CachedRow)
  enqueueAndFlush({
    opId: newId(),
    entity: 'bookmark',
    kind: 'upsert',
    rowId: row.id,
    bookId,
    payload: row as unknown as Record<string, unknown>,
    ts: Date.now(),
  })

  return row
}

export async function deleteBookmark(bookId: string, id: string): Promise<void> {
  await removeCachedRow('bookmark', bookId, id)
  enqueueAndFlush({
    opId: newId(),
    entity: 'bookmark',
    kind: 'delete',
    rowId: id,
    bookId,
    payload: {},
    ts: Date.now(),
  })
}

// ---- Progress ----

export async function getProgress(bookId: string): Promise<string | null> {
  const cached = await getCachedRows('progress', bookId)
  const cachedLocation = (cached.find((row) => row.id === bookId)?.location as string | undefined) ?? null

  if (!isOnline()) {
    return cachedLocation
  }

  try {
    const location = await getProgressRemote(bookId)
    await upsertCachedRow('progress', bookId, {
      id: bookId,
      book_id: bookId,
      location,
      updated_at: now(),
    })
    return location
  } catch {
    return cachedLocation
  }
}

export async function saveProgress(bookId: string, location: string): Promise<void> {
  await upsertCachedRow('progress', bookId, {
    id: bookId,
    book_id: bookId,
    location,
    updated_at: now(),
  })
  enqueueAndFlush({
    opId: newId(),
    entity: 'progress',
    kind: 'upsert',
    rowId: bookId,
    bookId,
    payload: { location },
    ts: Date.now(),
  })
}
