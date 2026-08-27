import { describe, expect, it } from "vitest";
import { addScore, createSession, decodeSnapshot, encodeSnapshot, lapParts, makeSnapshot, scoreMap, teamScores, undoLast, validateImported } from "./domain";

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
});
