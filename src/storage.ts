import type { LedgerSession } from "./types";

const DB_NAME = "game-night-score-ledger";
const STORE = "sessions";
const FALLBACK_KEY = "score-ledger:sessions";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local storage."));
  });
}

function fallbackRead(): LedgerSession[] {
  try { return JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "[]") as LedgerSession[]; }
  catch { return []; }
}

function fallbackWrite(items: LedgerSession[]): void {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(items));
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    action(transaction.objectStore(STORE), resolve, reject);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listSessions(): Promise<LedgerSession[]> {
  try {
    const sessions = await transact<LedgerSession[]>("readonly", (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as LedgerSession[]);
      request.onerror = () => reject(request.error);
    });
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return fallbackRead().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export async function getSession(id: string): Promise<LedgerSession | undefined> {
  try {
    return await transact<LedgerSession | undefined>("readonly", (store, resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as LedgerSession | undefined);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return fallbackRead().find((session) => session.id === id);
  }
}

export async function saveSession(session: LedgerSession): Promise<void> {
  try {
    await transact<void>("readwrite", (store, resolve, reject) => {
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    const items = fallbackRead().filter((item) => item.id !== session.id);
    fallbackWrite([...items, session]);
  }
  const channel = new BroadcastChannel("score-ledger");
  channel.postMessage({ type: "session", id: session.id, updatedAt: session.updatedAt });
  channel.close();
}

export async function saveConflictSafe(candidate: LedgerSession): Promise<LedgerSession> {
  const commit = async (): Promise<LedgerSession> => {
    const stored = await getSession(candidate.id);
    if (!stored) { await saveSession(candidate); return candidate; }
    const newest = stored.updatedAt > candidate.updatedAt ? stored : candidate;
    const events = [...stored.events, ...candidate.events]
      .filter((event, index, all) => all.findIndex((item) => item.id === event.id) === index)
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    const merged = { ...newest, events, updatedAt: new Date().toISOString() };
    await saveSession(merged);
    return merged;
  };
  return "locks" in navigator
    ? navigator.locks.request(`score-ledger:${candidate.id}`, commit)
    : commit();
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await transact<void>("readwrite", (store, resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    fallbackWrite(fallbackRead().filter((session) => session.id !== id));
  }
}
