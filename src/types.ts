export type Player = {
  id: string;
  name: string;
  team?: string;
};

export type ScoreEvent = {
  id: string;
  playerId: string;
  delta: number;
  round: number;
  at: string;
  note?: string;
  undoOf?: string;
};

export type LedgerSession = {
  version: 1;
  id: string;
  hostKey: string;
  title: string;
  players: Player[];
  teamsEnabled: boolean;
  lapThreshold: number | null;
  increments: number[];
  round: number;
  events: ScoreEvent[];
  status: "active" | "finished";
  createdAt: string;
  updatedAt: string;
};

export type ViewSnapshot = {
  version: 1;
  title: string;
  players: Player[];
  scores: Record<string, number>;
  teamsEnabled: boolean;
  lapThreshold: number | null;
  round: number;
  status: "active" | "finished";
  updatedAt: string;
  recentEvents: ScoreEvent[];
};
