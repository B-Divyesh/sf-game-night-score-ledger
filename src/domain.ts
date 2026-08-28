import type { LedgerSession, Player, ScoreEvent, ViewSnapshot } from "./types";

const MAX_PLAYERS = 12;
const MAX_PLAYER_NAME = 32;
const MAX_TEAM_NAME = 24;
const MAX_TITLE = 60;
const MAX_NOTE = 80;
const MAX_EVENTS = 100_000;

type CompactSnapshot = {
  v: 2;
  t: string;
  p: Array<[string, string?]>;
  s: number[];
  l: number | null;
  r: number;
  f: 0 | 1;
  u: number;
  e: Array<[number, number, number, number]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim()) || value.length > max) throw new Error(`The ${label} is invalid.`);
  return value.trim();
}

function readDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) throw new Error(`The ${label} is invalid.`);
  return new Date(value).toISOString();
}

function readInteger(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`The ${label} is invalid.`);
  return value;
}

function normaliseSession(value: unknown): LedgerSession {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.players) || !Array.isArray(value.events)) {
    throw new Error("Choose a Score Ledger JSON export.");
  }
  const id = readString(value.id, "ledger ID", 64);
  const hostKey = readString(value.hostKey, "host key", 128);
  const title = readString(value.title, "title", MAX_TITLE);
  if (value.players.length < 2 || value.players.length > MAX_PLAYERS) throw new Error("The imported ledger must have between two and twelve players.");
  const players = value.players.map((raw, index): Player => {
    if (!isRecord(raw)) throw new Error(`Player ${index + 1} is invalid.`);
    const player: Player = { id: readString(raw.id, `player ${index + 1} ID`, 64), name: readString(raw.name, `player ${index + 1} name`, MAX_PLAYER_NAME) };
    if (raw.team !== undefined) player.team = readString(raw.team, `player ${index + 1} team`, MAX_TEAM_NAME);
    return player;
  });
  if (new Set(players.map((player) => player.id)).size !== players.length) throw new Error("The imported ledger has duplicate player IDs.");
  if (new Set(players.map((player) => player.name.toLocaleLowerCase())).size !== players.length) throw new Error("The imported ledger has duplicate player names.");
  if (typeof value.teamsEnabled !== "boolean") throw new Error("The team setting is invalid.");
  const lapThreshold = value.lapThreshold === null ? null : readInteger(value.lapThreshold, "lap threshold", 2, 100_000);
  if (!Array.isArray(value.increments) || !value.increments.length || value.increments.length > 4) throw new Error("The quick score buttons are invalid.");
  const increments = value.increments.map((increment) => readInteger(increment, "quick score button", 1, 999));
  if (new Set(increments).size !== increments.length) throw new Error("The quick score buttons must be unique.");
  const round = readInteger(value.round, "round", 1, 1_000_000);
  if (value.status !== "active" && value.status !== "finished") throw new Error("The ledger status is invalid.");
  if (value.events.length > MAX_EVENTS) throw new Error("The imported ledger has too many score events.");
  const playerIds = new Set(players.map((player) => player.id));
  const eventIds = new Set<string>();
  const events = value.events.map((raw, index): ScoreEvent => {
    if (!isRecord(raw)) throw new Error(`Score event ${index + 1} is invalid.`);
    const event: ScoreEvent = {
      id: readString(raw.id, `score event ${index + 1} ID`, 64),
      playerId: readString(raw.playerId, `score event ${index + 1} player`, 64),
      delta: readInteger(raw.delta, `score event ${index + 1} change`, -999_999, 999_999),
      round: readInteger(raw.round, `score event ${index + 1} round`, 1, 1_000_000),
      at: readDate(raw.at, `score event ${index + 1} time`)
    };
    if (!event.delta || !playerIds.has(event.playerId) || eventIds.has(event.id)) throw new Error(`Score event ${index + 1} is invalid.`);
    eventIds.add(event.id);
    if (raw.note !== undefined) event.note = readString(raw.note, `score event ${index + 1} note`, MAX_NOTE, true);
    if (raw.undoOf !== undefined) event.undoOf = readString(raw.undoOf, `score event ${index + 1} undo reference`, 64);
    return event;
  });
  if (events.some((event) => event.undoOf && !eventIds.has(event.undoOf))) throw new Error("The imported ledger has an invalid undo reference.");
  return {
    version: 1, id, hostKey, title, players, teamsEnabled: value.teamsEnabled, lapThreshold, increments, round, events,
    status: value.status, createdAt: readDate(value.createdAt, "creation time"), updatedAt: readDate(value.updatedAt, "update time")
  };
}

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
    increments: validateQuickIncrements(input.increments ?? [1, 5, 10]),
    round: 1,
    events: [],
    status: "active",
    createdAt: now,
    updatedAt: now
  };
}

export function validateQuickIncrements(values: number[]): number[] {
  if (values.length < 1 || values.length > 4 || values.some((value) => !Number.isInteger(value) || value < 1 || value > 999) || new Set(values).size !== values.length) {
    throw new Error("Use one to four unique whole numbers from 1 to 999 for quick score buttons.");
  }
  return [...values];
}

/** Parses the human-entered setup field without changing the configured scores. */
export function parseQuickIncrements(value: string): number[] {
  const parts = value.split(",").map((part) => part.trim());
  if (parts.some((part) => !part)) throw new Error("Use one to four unique whole numbers from 1 to 999 for quick score buttons.");
  return validateQuickIncrements(parts.map(Number));
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
  const playerIndex = new Map(snapshot.players.map((player, index) => [player.id, index]));
  // IDs, event IDs, notes, and ISO punctuation are not useful to a guest. Keeping
  // only the display data makes a full 12-player board reliably QR-sized.
  const compact: CompactSnapshot = {
    v: 2,
    t: snapshot.title,
    p: snapshot.players.map((player) => player.team ? [player.name, player.team] : [player.name]),
    s: snapshot.players.map((player) => snapshot.scores[player.id]),
    l: snapshot.lapThreshold,
    r: snapshot.round,
    f: snapshot.status === "finished" ? 1 : 0,
    u: Date.parse(snapshot.updatedAt),
    e: snapshot.recentEvents.slice(-12).flatMap((event) => {
      const index = playerIndex.get(event.playerId);
      return index === undefined ? [] : [[index, event.delta, event.round, Date.parse(event.at)] as [number, number, number, number]];
    })
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function decodeSnapshot(encoded: string): ViewSnapshot {
  try {
    if (!/^[A-Za-z0-9_-]{1,12000}$/.test(encoded)) throw new Error("bad encoding");
    const normalized = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (isRecord(value) && value.v === 2) return expandCompactSnapshot(value as CompactSnapshot);
    return normaliseSnapshot(value);
  } catch {
    throw new Error("This view link is not a valid score snapshot.");
  }
}

export function validateImported(value: unknown): LedgerSession {
  const item = normaliseSession(value);
  return { ...item, id: uid(8), hostKey: uid(16), updatedAt: new Date().toISOString() };
}

/** Validates old IndexedDB/localStorage records without regenerating their host key. */
export function validateStored(value: unknown): LedgerSession { return normaliseSession(value); }

function normaliseSnapshot(value: unknown): ViewSnapshot {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.players) || !isRecord(value.scores) || !Array.isArray(value.recentEvents)) throw new Error("invalid snapshot");
  const players = value.players.map((raw, index): Player => {
    if (!isRecord(raw)) throw new Error("invalid player");
    const player: Player = { id: readString(raw.id, `player ${index + 1} ID`, 64), name: readString(raw.name, `player ${index + 1} name`, MAX_PLAYER_NAME) };
    if (raw.team !== undefined) player.team = readString(raw.team, `player ${index + 1} team`, MAX_TEAM_NAME);
    return player;
  });
  if (players.length < 1 || players.length > MAX_PLAYERS || new Set(players.map((player) => player.id)).size !== players.length) throw new Error("invalid players");
  const scores: Record<string, number> = {};
  for (const player of players) scores[player.id] = readInteger(value.scores[player.id], "score", -99_999_999, 99_999_999);
  const playerIds = new Set(players.map((player) => player.id));
  const recentEvents = value.recentEvents.slice(-12).map((raw, index): ScoreEvent => {
    if (!isRecord(raw)) throw new Error("invalid event");
    const event: ScoreEvent = { id: readString(raw.id, `event ${index + 1} ID`, 64), playerId: readString(raw.playerId, `event ${index + 1} player`, 64), delta: readInteger(raw.delta, "event change", -999_999, 999_999), round: readInteger(raw.round, "event round", 1, 1_000_000), at: readDate(raw.at, "event time") };
    if (!event.delta || !playerIds.has(event.playerId)) throw new Error("invalid event");
    return event;
  });
  return { version: 1, title: readString(value.title, "title", MAX_TITLE), players, scores, teamsEnabled: Boolean(value.teamsEnabled), lapThreshold: value.lapThreshold === null ? null : readInteger(value.lapThreshold, "lap threshold", 2, 100_000), round: readInteger(value.round, "round", 1, 1_000_000), status: value.status === "finished" ? "finished" : value.status === "active" ? "active" : (() => { throw new Error("invalid status"); })(), updatedAt: readDate(value.updatedAt, "update time"), recentEvents };
}

function expandCompactSnapshot(value: CompactSnapshot): ViewSnapshot {
  if (!Array.isArray(value.p) || !Array.isArray(value.s) || !Array.isArray(value.e) || value.p.length < 1 || value.p.length > MAX_PLAYERS || value.s.length !== value.p.length || value.f !== 0 && value.f !== 1) throw new Error("invalid snapshot");
  const players = value.p.map((raw, index): Player => {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 2) throw new Error("invalid player");
    return { id: `p${index}`, name: readString(raw[0], `player ${index + 1} name`, MAX_PLAYER_NAME), ...(raw[1] === undefined ? {} : { team: readString(raw[1], `player ${index + 1} team`, MAX_TEAM_NAME) }) };
  });
  const scores = Object.fromEntries(players.map((player, index) => [player.id, readInteger(value.s[index], "score", -99_999_999, 99_999_999)]));
  const recentEvents = value.e.slice(-12).map((raw, index): ScoreEvent => {
    if (!Array.isArray(raw) || raw.length !== 4) throw new Error("invalid event");
    const player = readInteger(raw[0], "event player", 0, players.length - 1);
    const at = readInteger(raw[3], "event time", 0, 9_999_999_999_999);
    const delta = readInteger(raw[1], "event change", -999_999, 999_999);
    if (!delta) throw new Error("invalid event");
    return { id: `e${index}`, playerId: players[player].id, delta, round: readInteger(raw[2], "event round", 1, 1_000_000), at: new Date(at).toISOString() };
  });
  return { version: 1, title: readString(value.t, "title", MAX_TITLE), players, scores, teamsEnabled: players.some((player) => Boolean(player.team)), lapThreshold: value.l === null ? null : readInteger(value.l, "lap threshold", 2, 100_000), round: readInteger(value.r, "round", 1, 1_000_000), status: value.f ? "finished" : "active", updatedAt: new Date(readInteger(value.u, "update time", 0, 9_999_999_999_999)).toISOString(), recentEvents };
}
