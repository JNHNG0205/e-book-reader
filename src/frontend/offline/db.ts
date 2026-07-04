import { openDB, type IDBPDatabase } from 'idb'

export const DB_NAME = 'ebook-reader'
export const DB_VERSION = 2

export const BOOKS_STORE = 'books' // key: bookId -> value: ArrayBuffer
export const OUTBOX_STORE = 'outbox' // key: opId -> value: OutboxOp
export const ENTITY_CACHE_STORE = 'entityCache' // key: `${entity}:${bookId}:${rowId}` -> value: CachedRow (with entity/bookId tags)

let dbPromise: Promise<IDBPDatabase> | null = null

export function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(BOOKS_STORE)) {
        database.createObjectStore(BOOKS_STORE)
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: 'opId' })
      }
      if (!database.objectStoreNames.contains(ENTITY_CACHE_STORE)) {
        database.createObjectStore(ENTITY_CACHE_STORE)
      }
    },
  })
  return dbPromise
}
