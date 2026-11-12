import { db } from './db';

/** Reads a saved preference, or `fallback` when it has never been set. */
export async function getPref<T>(key: string, fallback: T): Promise<T> {
  const row = await db.prefs.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setPref(key: string, value: unknown): Promise<void> {
  await db.prefs.put({ key, value });
}
