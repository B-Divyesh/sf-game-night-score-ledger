import { describe, expect, it } from "vitest";
import { addScore, createSession, decodeSnapshot, encodeSnapshot, lapParts, makeSnapshot, parseQuickIncrements, scoreMap, teamScores, undoLast, validateImported, validateQuickIncrements, validateStored } from "./domain";

describe("score ledger domain", () => {
  it("tracks raw scores, laps, teams, and an auditable undo", () => {
    let session = createSession({
      title: "Stone circle",
      players: [{ name: "Ada", team: "Mint" }, { name: "Bo", team: "Coral" }, { name: "Cy", team: "Mint" }],
      lapThreshold: 100
    });
    session = addScore(session, session.players[0].id, 125, "end round");
    session = addScore(session, session.players[2].id, 30);
    expect(scoreMap(session)[session.players[0].id]).toBe(125);
    expect(lapParts(125, 100)).toEqual({ laps: 1, position: 25 });
    expect(teamScores(session)[0]).toMatchObject({ name: "Mint", score: 155 });

    const originalId = session.events.at(-1)?.id;
    session = undoLast(session);
    expect(scoreMap(session)[session.players[2].id]).toBe(0);
    expect(session.events.at(-1)?.undoOf).toBe(originalId);
    expect(session.events).toHaveLength(3);
  });

  it("handles negative totals on wrapping tracks", () => {
    expect(lapParts(-1, 100)).toEqual({ laps: -1, position: 99 });
    expect(lapParts(10, null)).toBeNull();
  });

  it("round-trips a unicode guest snapshot without a host key", () => {
    const session = createSession({ title: "Café night", players: [{ name: "Zoë" }, { name: "李" }] });
    const encoded = encodeSnapshot(makeSnapshot(session));
    const decoded = decodeSnapshot(encoded);
    expect(decoded.title).toBe("Café night");
    expect(decoded.players[1].name).toBe("李");
    expect(encoded).not.toContain(session.hostKey);
  });

  it("imports as a new editable copy", () => {
    const session = createSession({ title: "Copy me", players: [{ name: "A" }, { name: "B" }] });
    const imported = validateImported(JSON.parse(JSON.stringify(session)));
    expect(imported.id).not.toBe(session.id);
    expect(imported.hostKey).not.toBe(session.hostKey);
    expect(imported.title).toBe(session.title);
  });

  it("rejects an unrelated JSON file", () => {
    expect(() => validateImported({ hello: "world" })).toThrow(/Score Ledger JSON/);
  });

  it("fully rejects malformed backups and stored records before persistence", () => {
    const session = createSession({ title: "Safe copy", players: [{ name: "Ada" }, { name: "Bo" }] });
    const malformed = JSON.parse(JSON.stringify(session));
    malformed.events = [{ id: "event", playerId: session.players[0].id, delta: 1.5, round: 1, at: "not a date" }];
    expect(() => validateImported(malformed)).toThrow(/score event/i);
    expect(() => validateStored({ ...session, players: [{ ...session.players[0] }] })).toThrow(/between two and twelve/i);
  });

  it("rejects invalid quick scores instead of changing them into score actions", () => {
    for (const value of ["", "1, 2, 3, 4, 5", "1.5", "-2", "0", "1, 1", "1000", "1,,2"]) {
      expect(() => parseQuickIncrements(value)).toThrow(/one to four unique whole numbers from 1 to 999/i);
    }
    expect(parseQuickIncrements("1, 25, 999")).toEqual([1, 25, 999]);
    expect(() => validateQuickIncrements([1, 999, 1000, -2])).toThrow(/one to four unique whole numbers from 1 to 999/i);
    expect(() => createSession({ title: "No coercion", players: [{ name: "Ada" }, { name: "Bo" }], increments: [1, 999, 1000, -2] })).toThrow(/one to four unique whole numbers from 1 to 999/i);
  });

  it("keeps the documented 12-player QR board inside a normal QR envelope", () => {
    let session = createSession({
      title: "T".repeat(60),
      players: Array.from({ length: 12 }, (_, index) => ({ name: `${index}`.padEnd(32, "N"), team: `${index}`.padEnd(24, "M") }))
    });
    for (const player of session.players) session = addScore(session, player.id, 1);
    const encoded = encodeSnapshot(makeSnapshot(session));
    expect(encoded.length).toBeLessThan(2_300);
    const decoded = decodeSnapshot(encoded);
    expect(decoded.players).toHaveLength(12);
    expect(decoded.recentEvents).toHaveLength(12);
    expect(decoded.scores[decoded.players[11].id]).toBe(1);
  });
});
