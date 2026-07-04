import { db, OUTBOX_STORE, ENTITY_CACHE_STORE } from './db'

export type Entity = 'highlight' | 'bookmark' | 'progress'

export interface OutboxOp {
  opId: string // crypto.randomUUID
  entity: Entity
  kind: 'upsert' | 'delete'
  rowId: string // pk (highlight/bookmark id) or `${bookId}` for progress
  bookId: string
  payload: Record<string, unknown> // the row to upsert (ignored for delete)
  ts: number // client timestamp (caller-supplied)
}

export type CachedRow = { id: string } & Record<string, unknown>

function cacheKey(entity: Entity, bookId: string, rowId: string): string {
  return `${entity}:${bookId}:${rowId}`
}

function cacheKeyRange(entity: Entity, bookId: string): IDBKeyRange {
  const prefix = `${entity}:${bookId}:`
  return IDBKeyRange.bound(prefix, `${prefix}￿`)
}

// ---- Outbox ----

export async function enqueueOp(op: OutboxOp): Promise<void> {
  await (await db()).put(OUTBOX_STORE, op)
}

export async function allOps(): Promise<OutboxOp[]> {
  const ops = (await (await db()).getAll(OUTBOX_STORE)) as OutboxOp[]
  return ops.slice().sort((a, b) => a.ts - b.ts)
}

export async function removeOp(opId: string): Promise<void> {
  await (await db()).delete(OUTBOX_STORE, opId)
}

// ---- Entity cache ----

export async function putCachedRows(entity: Entity, bookId: string, rows: CachedRow[]): Promise<void> {
  const database = await db()
  const tx = database.transaction(ENTITY_CACHE_STORE, 'readwrite')
  const store = tx.objectStore(ENTITY_CACHE_STORE)
  let cursor = await store.openCursor(cacheKeyRange(entity, bookId))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  for (const row of rows) {
    await store.put(row, cacheKey(entity, bookId, row.id))
  }
  await tx.done
}

export async function getCachedRows(entity: Entity, bookId: string): Promise<CachedRow[]> {
  return (await (await db()).getAll(ENTITY_CACHE_STORE, cacheKeyRange(entity, bookId))) as CachedRow[]
}

export async function upsertCachedRow(entity: Entity, bookId: string, row: CachedRow): Promise<void> {
  await (await db()).put(ENTITY_CACHE_STORE, row, cacheKey(entity, bookId, row.id))
}

export async function removeCachedRow(entity: Entity, bookId: string, rowId: string): Promise<void> {
  await (await db()).delete(ENTITY_CACHE_STORE, cacheKey(entity, bookId, rowId))
}
