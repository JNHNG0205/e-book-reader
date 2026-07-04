import { db, BOOKS_STORE as STORE } from './db'

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
