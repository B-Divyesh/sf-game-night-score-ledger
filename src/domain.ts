import type { LedgerSession, Player, ScoreEvent, ViewSnapshot } from "./types";

export function uid(size = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, size * 2);
}

export function createSession(input: {
  title: string;
  players: Array<{ name: string; team?: string }>;
  lapThreshold?: number | null;
  increments?: number[];
}): LedgerSession {
  const now = new Date().toISOString();
  const players: Player[] = input.players.map((player) => ({
    id: uid(6),
    name: player.name.trim(),
    team: player.team?.trim() || undefined
  }));
  return {
    version: 1,
    id: uid(8),
    hostKey: uid(16),
    title: input.title.trim() || "Game night",
    players,
    teamsEnabled: players.some((player) => Boolean(player.team)),
    lapThreshold: input.lapThreshold && input.lapThreshold > 0 ? Math.floor(input.lapThreshold) : null,
    increments: cleanIncrements(input.increments ?? [1, 5, 10]),
    round: 1,
    events: [],
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

export function cleanIncrements(values: number[]): number[] {
  const result = [...new Set(values.map(Math.abs).map(Math.floor).filter((value) => value > 0 && value <= 999))];
  return result.slice(0, 4).length ? result.slice(0, 4) : [1, 5, 10];
}

export function scoreMap(session: Pick<LedgerSession, "players" | "events">): Record<string, number> {
  const scores = Object.fromEntries(session.players.map((player) => [player.id, 0]));
  for (const event of session.events) {
    if (event.playerId in scores) scores[event.playerId] += event.delta;
  }
  return scores;
}

export function teamScores(session: LedgerSession): Array<{ name: string; score: number }> {
  const scores = scoreMap(session);
  const totals = new Map<string, number>();
  for (const player of session.players) {
    if (player.team) totals.set(player.team, (totals.get(player.team) ?? 0) + scores[player.id]);
  }
  return [...totals].map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function addScore(session: LedgerSession, playerId: string, delta: number, note?: string): LedgerSession {
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 999999) throw new Error("Enter a score change between -999999 and 999999.");
  if (!session.players.some((player) => player.id === playerId)) throw new Error("That player is no longer in this ledger.");
  const now = new Date().toISOString();
  const event: ScoreEvent = {
    id: uid(8),
    playerId,
    delta: Math.trunc(delta),
    round: session.round,
    at: now,
    note: note?.trim() || undefined
  };
  return { ...session, events: [...session.events, event], updatedAt: now };
}

export function undoLast(session: LedgerSession): LedgerSession {
  const alreadyUndone = new Set(session.events.filter((event) => event.undoOf).map((event) => event.undoOf));
  const original = [...session.events].reverse().find((event) => !event.undoOf && !alreadyUndone.has(event.id));
  if (!original) return session;
  const player = session.players.find((item) => item.id === original.playerId);
  const now = new Date().toISOString();
  const event: ScoreEvent = {
    id: uid(8),
    playerId: original.playerId,
    delta: -original.delta,
    round: session.round,
    at: now,
    note: `Undo ${original.delta > 0 ? "+" : ""}${original.delta} for ${player?.name ?? "player"}`,
    undoOf: original.id
  };
  return { ...session, events: [...session.events, event], updatedAt: now };
}

export function lapParts(total: number, threshold: number | null): { laps: number; position: number } | null {
  if (!threshold) return null;
  return {
    laps: Math.floor(total / threshold),
    position: ((total % threshold) + threshold) % threshold
  };
}

export function makeSnapshot(session: LedgerSession): ViewSnapshot {
  return {
    version: 1,
    title: session.title,
    players: session.players,
    scores: scoreMap(session),
    teamsEnabled: session.teamsEnabled,
    lapThreshold: session.lapThreshold,
    round: session.round,
    status: session.status,
    updatedAt: session.updatedAt,
    recentEvents: session.events.slice(-12)
  };
}

export function encodeSnapshot(snapshot: ViewSnapshot): string {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeSnapshot(encoded: string): ViewSnapshot {
  const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const value = JSON.parse(new TextDecoder().decode(bytes)) as ViewSnapshot;
  if (value.version !== 1 || !Array.isArray(value.players) || typeof value.scores !== "object") throw new Error("This view link is not a valid score snapshot.");
  return value;
}

export function validateImported(value: unknown): LedgerSession {
  const item = value as Partial<LedgerSession>;
  if (item.version !== 1 || typeof item.id !== "string" || typeof item.hostKey !== "string" || !Array.isArray(item.players) || !Array.isArray(item.events)) {
    throw new Error("Choose a Score Ledger JSON export.");
  }
  if (item.players.length < 1 || item.players.some((player) => typeof player?.id !== "string" || typeof player?.name !== "string")) {
    throw new Error("The imported ledger has invalid players.");
  }
  return { ...item, id: uid(8), hostKey: uid(16), updatedAt: new Date().toISOString() } as LedgerSession;
}
