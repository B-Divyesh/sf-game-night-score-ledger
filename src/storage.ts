import type { LedgerSession } from "./types";
import { validateStored } from "./domain";

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

function cleanSessions(values: unknown[]): LedgerSession[] {
  return values.flatMap((value) => {
    try { return [validateStored(value)]; }
    catch { return []; }
  });
}

function fallbackRead(): LedgerSession[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FALLBACK_KEY) ?? "[]");
    const sessions = cleanSessions(Array.isArray(parsed) ? parsed : []);
    // Repair a damaged fallback record as soon as it is observed, leaving valid
    // ledgers intact instead of making the whole app unusable.
    if (!Array.isArray(parsed) || sessions.length !== parsed.length) fallbackWrite(sessions);
    return sessions;
  } catch {
    try { localStorage.removeItem(FALLBACK_KEY); } catch { /* storage may be unavailable */ }
    return [];
  }
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
    return cleanSessions(sessions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return fallbackRead().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

export async function getSession(id: string): Promise<LedgerSession | undefined> {
  try {
    const session = await transact<LedgerSession | undefined>("readonly", (store, resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as LedgerSession | undefined);
      request.onerror = () => reject(request.error);
    });
    if (!session) return undefined;
    try { return validateStored(session); }
    catch { void deleteSession(id); return undefined; }
  } catch {
    return fallbackRead().find((session) => session.id === id);
  }
}

export async function saveSession(session: LedgerSession): Promise<void> {
  // Never write an object that has not passed the same complete schema check as
  // an imported backup. This is the last persistence boundary.
  const checked = validateStored(session);
  try {
    await transact<void>("readwrite", (store, resolve, reject) => {
      const request = store.put(checked);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    const items = fallbackRead().filter((item) => item.id !== checked.id);
    fallbackWrite([...items, checked]);
  }
  const channel = new BroadcastChannel("score-ledger");
  channel.postMessage({ type: "session", id: checked.id, updatedAt: checked.updatedAt });
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
