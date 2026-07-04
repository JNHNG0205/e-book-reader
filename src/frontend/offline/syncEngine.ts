import { allOps, removeOp, type OutboxOp } from './syncStore'
import { upsertHighlight, deleteHighlight } from '@backend/data/highlights'
import { upsertBookmark, deleteBookmark } from '@backend/data/bookmarks'
import { saveProgress } from '@backend/data/progress'
import { getUserIdLocal } from '@backend/data/currentUser'
import type { Highlight, Bookmark } from '@shared/types'

let inFlight = false

// A row created offline before the session was readable can carry an empty user_id, which
// RLS (auth.uid() = user_id) would reject — permanently wedging the FIFO queue at that op.
// Sync runs while online+authenticated, so backfill user_id from the local session here.
async function withUserId<T extends { user_id?: string }>(row: T): Promise<T> {
  if (row.user_id) return row
  return { ...row, user_id: (await getUserIdLocal()) ?? row.user_id }
}

async function dispatch(op: OutboxOp): Promise<void> {
  switch (op.entity) {
    case 'highlight':
      if (op.kind === 'upsert') await upsertHighlight(await withUserId(op.payload as unknown as Highlight))
      else await deleteHighlight(op.rowId)
      return
    case 'bookmark':
      if (op.kind === 'upsert') await upsertBookmark(await withUserId(op.payload as unknown as Bookmark))
      else await deleteBookmark(op.rowId)
      return
    case 'progress':
      await saveProgress(op.bookId, String(op.payload.location))
      return
  }
}

/**
 * Drains the outbox to Supabase, in FIFO order (per allOps()'s ts ordering).
 * Stops at the first failure, leaving that op and everything after it in the
 * outbox for a later flush. A module-level in-flight guard means a second,
 * overlapping call returns immediately without dispatching anything.
 *
 * The outer loop re-reads the outbox after fully draining a snapshot, so an op
 * enqueued WHILE a flush was in progress (whose own flush call the in-flight
 * guard skipped) still gets drained in this same run — it isn't stranded until
 * the next write / `online` event.
 */
export async function flushOutbox(): Promise<{ synced: number; remaining: number }> {
  if (inFlight) return { synced: 0, remaining: 0 }
  inFlight = true
  let synced = 0
  try {
    for (;;) {
      const ops = await allOps()
      if (ops.length === 0) return { synced, remaining: 0 }
      for (let i = 0; i < ops.length; i++) {
        try {
          await dispatch(ops[i])
          await removeOp(ops[i].opId)
          synced++
        } catch {
          return { synced, remaining: ops.length - i }
        }
      }
      // Snapshot fully drained — loop re-reads to catch ops added mid-flush.
    }
  } finally {
    inFlight = false
  }
}

/**
 * Flushes once immediately (best-effort — errors are swallowed) and again on
 * every subsequent `online` event. Returns an unsubscribe function.
 */
export function startAutoSync(): () => void {
  flushOutbox().catch(() => {})

  const onOnline = (): void => {
    flushOutbox().catch(() => {})
  }
  window.addEventListener('online', onOnline)

  return () => {
    window.removeEventListener('online', onOnline)
  }
}
