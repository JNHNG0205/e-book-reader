import { allOps, removeOp, type OutboxOp } from './syncStore'
import { upsertHighlight, deleteHighlight } from '@backend/data/highlights'
import { upsertBookmark, deleteBookmark } from '@backend/data/bookmarks'
import { saveProgress } from '@backend/data/progress'
import type { Highlight, Bookmark } from '@shared/types'

let inFlight = false

async function dispatch(op: OutboxOp): Promise<void> {
  switch (op.entity) {
    case 'highlight':
      if (op.kind === 'upsert') await upsertHighlight(op.payload as unknown as Highlight)
      else await deleteHighlight(op.rowId)
      return
    case 'bookmark':
      if (op.kind === 'upsert') await upsertBookmark(op.payload as unknown as Bookmark)
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
 */
export async function flushOutbox(): Promise<{ synced: number; remaining: number }> {
  if (inFlight) return { synced: 0, remaining: 0 }
  inFlight = true
  try {
    const ops = await allOps()
    let synced = 0
    for (let i = 0; i < ops.length; i++) {
      try {
        await dispatch(ops[i])
        await removeOp(ops[i].opId)
        synced++
      } catch {
        return { synced, remaining: ops.length - i }
      }
    }
    return { synced, remaining: 0 }
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
