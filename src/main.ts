import "./style.css";
import type { LedgerSession, Player, ViewSnapshot } from "./types";
import { addScore, createSession, decodeSnapshot, encodeSnapshot, lapParts, makeSnapshot, parseQuickIncrements, scoreMap, teamScores, undoLast, validateImported } from "./domain";
import { deleteSession, getSession, listSessions, saveConflictSafe, saveSession } from "./storage";
import { captureLicenseFromUrl, checkoutUrl, initialLicenseState, restoreLicense, verifyLicense, type LicenseState } from "./license";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) throw new Error("App mount not found");
const root: HTMLDivElement = appRoot;
const initialUrl = new URL(location.href);
const demoMode = initialUrl.pathname.replace(/\/$/, "") === "/demo" || initialUrl.searchParams.get("demo") === "1";

type SetupPlayer = { name: string; team: string };
type SetupDetails = { title: string; lap: string; increments: string };
let savedSessions: LedgerSession[] = [];
let currentSession: LedgerSession | null = null;
let currentSnapshot: ViewSnapshot | null = null;
let setupPlayers: SetupPlayer[] = [{ name: "", team: "" }, { name: "", team: "" }];
let setupTeams = false;
let setupDetails: SetupDetails = { title: "Game night", lap: "", increments: "1, 5, 10" };
let lastChanged = "";
let license: LicenseState = demoMode ? { unlocked: false, checking: false, notice: "" } : initialLicenseState();
let returnFocus: HTMLElement | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let applyingServiceWorkerUpdate = false;
// Persisting a ledger crosses an asynchronous IndexedDB boundary. Keep mutations
// in input order so a burst of score taps can never race a stale save back onto
// the board.
let sessionMutationQueue: Promise<void> = Promise.resolve();

const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char);
const formatTime = (iso: string): string => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const formatDate = (iso: string): string => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
const signed = (value: number): string => `${value > 0 ? "+" : ""}${value}`;

function makeDemoSession(): LedgerSession {
  const now = Date.now();
  const at = (minutesAgo: number): string => new Date(now - minutesAgo * 60_000).toISOString();
  const players: Player[] = [
    { id: "demo-maya", name: "Maya", team: "Cedar" },
    { id: "demo-theo", name: "Theo", team: "Coral" },
    { id: "demo-priya", name: "Priya", team: "Cedar" },
    { id: "demo-jonah", name: "Jonah", team: "Coral" }
  ];
  return {
    version: 1,
    id: "demo:sample-session",
    hostKey: "demo:host",
    title: "Saturday strategy final",
    players,
    teamsEnabled: true,
    lapThreshold: 100,
    increments: [1, 5, 10, 25],
    round: 3,
    events: [
      { id: "demo-e1", playerId: "demo-maya", delta: 62, round: 1, at: at(42), note: "Round total" },
      { id: "demo-e2", playerId: "demo-theo", delta: 48, round: 1, at: at(39), note: "Round total" },
      { id: "demo-e3", playerId: "demo-priya", delta: 76, round: 1, at: at(36), note: "Round total" },
      { id: "demo-e4", playerId: "demo-jonah", delta: 35, round: 1, at: at(33), note: "Round total" },
      { id: "demo-e5", playerId: "demo-maya", delta: 80, round: 2, at: at(21), note: "Objective bonus" },
      { id: "demo-e6", playerId: "demo-theo", delta: 53, round: 2, at: at(18), note: "Round total" },
      { id: "demo-e7", playerId: "demo-priya", delta: 49, round: 2, at: at(15), note: "Round total" },
      { id: "demo-e8", playerId: "demo-jonah", delta: 38, round: 2, at: at(12), note: "Round total" }
    ],
    status: "active",
    createdAt: at(55),
    updatedAt: at(12)
  };
}

function setPageTitle(title: string): void {
  document.title = title;
}

function shell(content: string, wide = false): string {
  return `<div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="Game Night Score Ledger home"><img src="/icons/mark.svg" width="36" height="36" alt=""><span>Game Night Score Ledger</span></a>
      <nav class="site-nav" aria-label="Primary"><a href="/demo">Demo</a><a href="/?new=1">New ledger</a><a href="/privacy/">Privacy</a></nav>
      <div class="header-actions">
        <span class="network-state ${navigator.onLine ? "" : "offline"}" aria-live="polite"><span>${demoMode ? (navigator.onLine ? "Sample ready" : "Offline sample") : (navigator.onLine ? "Saved locally" : "Offline · saved locally")}</span></span>
        <button class="license-button" data-action="license" aria-label="Host pack and license"><span aria-hidden="true">${license.unlocked ? "✦" : "◇"}</span><span class="license-name">Host pack</span></button>
      </div>
    </header>
    ${demoMode ? `<aside class="demo-banner" aria-label="Demo mode"><strong>Demo — sample data, nothing is saved</strong><div><button class="demo-link" data-action="reset-demo">Reset demo</button><a class="demo-link" href="/?new=1">Start for real</a></div></aside>` : ""}
    <main id="main" class="main ${wide ? "wide" : ""}">${content}</main>
    <footer class="site-footer"><span>Scorekeeping for long board-game nights. Original generated score landscape.</span><nav class="footer-links" aria-label="Footer"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><span>Built by Param Factory</span><span>v1.1.0</span></nav></footer>
    <dialog id="action-dialog" aria-labelledby="dialog-title"></dialog>
    <div id="toast" class="toast" role="status" hidden><span id="toast-text"></span><button class="button small secondary" data-action="reload">Reload</button></div>
    <div id="live" class="live-region" aria-live="polite" aria-atomic="true"></div>
  </div>`;
}

function renderHome(): void {
  currentSession = null;
  currentSnapshot = null;
  history.replaceState({}, "", "/");
  setPageTitle("Game Night Score Ledger — Track scores with laps");
  const recent = savedSessions.length ? `<section class="recent" aria-labelledby="recent-title"><div class="recent-head"><div><p class="eyebrow">On this device</p><h2 id="recent-title">Recent ledgers</h2></div><button class="button secondary" data-action="import">Import JSON</button><input id="import-file" type="file" accept="application/json" hidden></div><ul class="recent-list">${savedSessions.map((session) => {
    const totals = scoreMap(session); const leader = [...session.players].sort((a, b) => totals[b.id] - totals[a.id])[0];
    return `<li class="recent-item glass"><span class="status-chip ${session.status === "finished" ? "finished" : ""}">${session.status}</span><h3>${escapeHtml(session.title)}</h3><p class="muted">${session.players.length} players${leader ? ` · ${escapeHtml(leader.name)} ${totals[leader.id]}` : ""}<br>Updated ${formatDate(session.updatedAt)}</p><div class="row-actions"><button class="button small" data-action="open-session" data-id="${session.id}">Open ledger</button><button class="button small ghost" data-action="delete-session" data-id="${session.id}" data-title="${escapeHtml(session.title)}">Delete</button></div></li>`;
  }).join("")}</ul></section>` : `<section class="recent" aria-labelledby="recent-title"><p class="eyebrow">Saved ledgers</p><h2 id="recent-title">No saved ledgers yet</h2><div class="empty-inline">Start a ledger. Saved score changes will appear here.</div><p><button class="button secondary" data-action="import">Import a ledger JSON</button><input id="import-file" type="file" accept="application/json" hidden></p></section>`;
  root.innerHTML = shell(`<section class="hero"><div class="hero-copy"><p class="eyebrow">For board-game hosts</p><h1>Track board-game scores with laps and teams</h1><p>For hosts running long games, this ledger keeps every score change clear while play continues.</p><div class="hero-actions"><a class="button" href="/demo">Try it with sample data</a><button class="button secondary" data-action="start">Start a new ledger</button>${savedSessions[0] ? `<button class="button ghost" data-action="open-session" data-id="${savedSessions[0].id}">Continue last ledger</button>` : ""}</div><p class="action-note">The sample opens a filled ledger with teams, laps, and score changes.</p><ul class="proof-strip" aria-label="Product facts"><li>Works offline after the first visit.</li><li>Scores stay in this browser.</li><li>Free core. Host pack: $12 once.</li></ul></div><picture class="hero-art"><source srcset="/assets/score-aurora.webp" type="image/webp"><img src="/assets/score-aurora.jpg" width="1280" height="854" alt="Glass score columns and lap rings show the score-tracking idea" fetchpriority="high"></picture></section>${recent}<section class="how-it-works" aria-labelledby="how-title"><p class="eyebrow">Three steps</p><h2 id="how-title">How scorekeeping works</h2><ol class="step-list"><li><strong>Add players.</strong><span>Choose quick scores, teams, and an optional lap threshold.</span></li><li><strong>Record each change.</strong><span>Tap points or enter a correction. The score trail keeps both.</span></li><li><strong>Share the result.</strong><span>Open a view-only QR snapshot or export CSV, PNG, and JSON files.</span></li></ol></section><section class="limits" aria-labelledby="limits-title"><div><p class="eyebrow">Scope and privacy</p><h2 id="limits-title">What this ledger does not do</h2></div><p>It has no accounts, ads, analytics, rules database, or automatic sync. A guest link is a snapshot, not a live board.</p></section><section class="pack-section" aria-labelledby="pack-title"><div><p class="eyebrow">Optional purchase</p><h2 id="pack-title">Add Table view for $12 once</h2><p>The free ledger includes scoring, teams, laps, history, sharing, and every export. Host pack adds the large-screen Table view.</p></div><button class="button secondary" data-action="license">View Host pack</button></section>`);
}

function renderSetup(error = "", errorField?: "increments"): void {
  const teamInputs = setupTeams;
  setPageTitle("New ledger — Game Night Score Ledger");
  root.innerHTML = shell(`<section class="setup glass" aria-labelledby="setup-title"><div class="setup-head"><div><p class="eyebrow">New score ledger</p><h1 id="setup-title" class="compact-title">Set up a score ledger</h1><p class="muted">Add player names. Change the other fields only when the game needs them.</p></div><button class="button ghost" data-action="cancel-setup">Cancel</button></div>
    <form id="setup-form" novalidate><div class="form-grid"><div class="field"><label for="game-title">Game or session name</label><input id="game-title" name="title" maxlength="60" value="${escapeHtml(setupDetails.title)}" required autocomplete="off"></div><div class="field"><label for="lap-threshold">Score track wraps at <span class="muted">(optional)</span></label><input id="lap-threshold" name="lap" type="number" min="2" max="100000" inputmode="numeric" value="${escapeHtml(setupDetails.lap)}" placeholder="For example, 100"><small>We’ll show laps plus track position.</small></div></div>
    <div class="players-editor"><div class="players-editor-head"><span class="field-label">Players</span><button type="button" class="button small secondary" data-action="add-player">Add player</button></div>${setupPlayers.map((player, index) => `<div class="player-editor"><label class="live-region" for="player-${index}">Player ${index + 1} name</label><input id="player-${index}" data-player-index="${index}" data-field="name" maxlength="32" value="${escapeHtml(player.name)}" placeholder="Player ${index + 1}" required autocomplete="off">${teamInputs ? `<label class="live-region" for="team-${index}">Team for ${player.name || `player ${index + 1}`}</label><input class="team-input" id="team-${index}" data-player-index="${index}" data-field="team" maxlength="24" value="${escapeHtml(player.team)}" placeholder="Team name">` : ""}<button type="button" class="icon-button" data-action="remove-player" data-index="${index}" aria-label="Remove player ${index + 1}" ${setupPlayers.length <= 2 ? "disabled" : ""}>×</button></div>`).join("")}</div>
    <div class="form-grid"><label class="field-label"><input id="teams-toggle" type="checkbox" style="width:20px;min-height:20px;margin-right:9px" ${setupTeams ? "checked" : ""}> Add team totals</label><div class="field"><label for="increments">Quick score buttons</label><input id="increments" name="increments" value="${escapeHtml(setupDetails.increments)}" inputmode="numeric" aria-describedby="increments-help${errorField === "increments" ? " setup-error" : ""}" aria-invalid="${errorField === "increments"}"><small id="increments-help">Up to four positive values, separated by commas.</small></div></div><p id="setup-error" class="form-error" role="alert">${escapeHtml(error)}</p><div class="dialog-actions"><button type="submit" class="button">Create ledger</button></div></form></section>`);
  if (errorField === "increments") document.querySelector<HTMLInputElement>("#increments")?.focus();
}

function scoreCard(player: Player, score: number, leaderId: string, session: Pick<LedgerSession, "players" | "lapThreshold" | "status" | "increments">, editable = true): string {
  const lap = lapParts(score, session.lapThreshold);
  return `<article class="score-row glass ${player.id === leaderId && session.players.length > 1 ? "leader" : ""}" aria-labelledby="player-${player.id}"><div><h2 id="player-${player.id}" class="player-name">${escapeHtml(player.name)}</h2>${player.team ? `<span class="player-team">${escapeHtml(player.team)}</span>` : ""}</div><div class="score-main"><div class="score-number ${lastChanged === player.id ? "changed" : ""}">${score}</div>${lap ? `<div class="lap-readout"><strong>${lap.laps} ${Math.abs(lap.laps) === 1 ? "lap" : "laps"}</strong> · position ${lap.position} of ${session.lapThreshold}</div>` : ""}</div>${editable && session.status === "active" ? `<div class="score-controls"><div class="increment-group" aria-label="Add points for ${escapeHtml(player.name)}">${session.increments.map((amount) => `<button class="increment" data-action="score" data-player="${player.id}" data-delta="${amount}" aria-label="Add ${amount} points to ${escapeHtml(player.name)}">+${amount}</button>`).join("")}</div><button class="button small secondary" data-action="custom-score" data-player="${player.id}" data-name="${escapeHtml(player.name)}" aria-label="Adjust score for ${escapeHtml(player.name)}"><span>Adjust</span> ±</button></div>` : ""}</article>`;
}

function renderSession(): void {
  if (!currentSession) return;
  const session = currentSession;
  setPageTitle(demoMode ? "Demo — Game Night Score Ledger" : `${session.title.slice(0, 32)} — Score Ledger`);
  const scores = scoreMap(session);
  const ordered = [...session.players].sort((a, b) => scores[b.id] - scores[a.id] || a.name.localeCompare(b.name));
  const leaderId = ordered[0]?.id ?? "";
  const teams = session.teamsEnabled ? teamScores(session) : [];
  const historyItems = [...session.events].reverse();
  root.innerHTML = shell(`<section class="session-head"><div><p class="eyebrow">Round ${session.round}</p><h1>${escapeHtml(session.title)}</h1><div class="session-meta"><span class="status-chip ${session.status === "finished" ? "finished" : ""}">${session.status}</span><span>${session.players.length} players</span>${session.lapThreshold ? `<span>Track wraps at ${session.lapThreshold}</span>` : ""}</div></div><div class="toolbar"><button class="button secondary" data-action="share">Share view</button><button class="button secondary" data-action="export-csv">Export CSV</button><button class="button secondary" data-action="export-image">Save image</button><button class="button secondary" data-action="table-mode">Table view${license.unlocked ? "" : " · ✦"}</button></div></section>
    ${teams.length ? `<section class="team-rail" aria-label="Team totals">${teams.map((team) => `<div class="team-total glass"><span class="muted">${escapeHtml(team.name)}</span><strong>${team.score}</strong></div>`).join("")}</section>` : ""}
    <div class="session-layout"><section class="score-list" aria-label="Player scores">${ordered.map((player) => scoreCard(player, scores[player.id], leaderId, session)).join("")}</section><aside class="history glass" aria-labelledby="history-title"><div class="history-head"><h2 id="history-title">Score trail</h2>${session.status === "active" ? `<button class="button small ghost" data-action="undo" ${historyItems.length ? "" : "disabled"}>Undo last</button>` : ""}</div>${historyItems.length ? `<ol class="history-list">${historyItems.map((event) => { const player = session.players.find((item) => item.id === event.playerId); return `<li class="event"><strong>${escapeHtml(player?.name ?? "Removed player")}</strong><span class="event-delta ${event.delta < 0 ? "negative" : ""}">${signed(event.delta)}</span><span class="event-meta">Round ${event.round} · ${formatTime(event.at)}${event.note ? ` · ${escapeHtml(event.note)}` : ""}</span></li>`; }).join("")}</ol>` : `<div class="history-empty">The first score change will start the audit trail.</div>`}${session.status === "active" ? `<button class="button secondary round-action" data-action="next-round">Start round ${session.round + 1}</button><button class="button ghost round-action" data-action="finish">Finish and save</button>` : `<button class="button secondary round-action" data-action="reopen">Reopen ledger</button>`}<button class="button ghost round-action" data-action="export-json">Export backup JSON</button></aside></div>`, true);
  lastChanged = "";
}

function renderSnapshot(): void {
  if (!currentSnapshot) return;
  const snapshot = currentSnapshot;
  setPageTitle(demoMode ? "Demo — Game Night Score Ledger" : "Guest score — Game Night Score Ledger");
  const ordered = [...snapshot.players].sort((a, b) => snapshot.scores[b.id] - snapshot.scores[a.id] || a.name.localeCompare(b.name));
  const leaderId = ordered[0]?.id ?? "";
  const pseudoSession: Pick<LedgerSession, "players" | "lapThreshold" | "status" | "increments"> = { players: snapshot.players, lapThreshold: snapshot.lapThreshold, status: snapshot.status, increments: [] };
  const teamTotals = new Map<string, number>();
  for (const player of snapshot.players) if (player.team) teamTotals.set(player.team, (teamTotals.get(player.team) ?? 0) + snapshot.scores[player.id]);
  root.innerHTML = shell(`<div class="view-banner"><strong>View only.</strong> This QR captures a score snapshot; ask the host to reshare for newer scores.</div><section class="session-head"><div><p class="eyebrow">Round ${snapshot.round} · guest view</p><h1>${escapeHtml(snapshot.title)}</h1><p class="stale">Captured ${formatDate(snapshot.updatedAt)} at ${formatTime(snapshot.updatedAt)}</p></div><div class="toolbar"><a href="/" class="button secondary">Start your own ledger</a></div></section>${teamTotals.size ? `<section class="team-rail" aria-label="Team totals">${[...teamTotals].sort((a,b)=>b[1]-a[1]).map(([name,score]) => `<div class="team-total glass"><span class="muted">${escapeHtml(name)}</span><strong>${score}</strong></div>`).join("")}</section>` : ""}<div class="session-layout"><section class="score-list" aria-label="Player scores">${ordered.map((player) => scoreCard(player, snapshot.scores[player.id], leaderId, pseudoSession, false)).join("")}</section><aside class="history glass"><h2>Recent trail</h2>${snapshot.recentEvents.length ? `<ol class="history-list">${[...snapshot.recentEvents].reverse().map((event) => `<li class="event"><strong>${escapeHtml(snapshot.players.find((p) => p.id === event.playerId)?.name ?? "Player")}</strong><span class="event-delta ${event.delta < 0 ? "negative" : ""}">${signed(event.delta)}</span><span class="event-meta">Round ${event.round} · ${formatTime(event.at)}</span></li>`).join("")}</ol>` : `<div class="history-empty">No score changes when this view was shared.</div>`}</aside></div>`, true);
}

function renderError(title: string, message: string): void {
  setPageTitle("Error — Game Night Score Ledger");
  root.innerHTML = shell(`<section class="setup glass"><p class="eyebrow">Could not open ledger</p><h1 class="compact-title">${escapeHtml(title)}</h1><p class="muted measure">${escapeHtml(message)}</p><a class="button" href="/">Return home</a></section>`);
}

function renderLegal(page: "privacy" | "terms"): void {
  setPageTitle(`${page === "privacy" ? "Privacy" : "Terms"} — Game Night Score Ledger`);
  const privacy = `<article class="legal"><p class="eyebrow">Policy</p><h1>Privacy</h1><p><strong>Last updated September 5, 2026.</strong></p><h2>Data stored in this browser</h2><p>Ledgers, player names, scores, and settings are stored in this browser. The demo stays in memory and does not open saved ledgers.</p><p>We do not run analytics or create accounts.</p><h2>Sharing and exports</h2><p>A guest QR puts a compressed scoreboard copy in its link. Anyone with the link can read that snapshot.</p><p>The snapshot cannot edit scores and does not update automatically. CSV, PNG, and JSON exports are created in your browser.</p><h2>Purchases</h2><p>Sociobot and Dodo process Host pack checkout. This app has no payment-card form.</p><p>The app stores a restored license and its result in this browser. It sends the license only to Sociobot for verification.</p><h2>Delete your data</h2><p>Delete a ledger in the app. Clear this site’s browser data to remove every ledger and saved license.</p><p><a href="/">Back to Score Ledger</a></p></article>`;
  const terms = `<article class="legal"><p class="eyebrow">Product terms</p><h1>Terms</h1><p><strong>Effective September 5, 2026.</strong></p><h2>Using the ledger</h2><p>Use Game Night Score Ledger for personal or group scorekeeping. Check entered scores and keep any exports you need.</p><p>Do not disrupt the site or its license service.</p><h2>Free and paid features</h2><p>Core scoring, laps, teams, history, sharing, and exports are free. Host pack costs $12 once and adds Table view.</p><p>Sociobot and Dodo are the merchant of record. Their refund process revokes the related license.</p><h2>Availability</h2><p>The ledger can reload offline after the first visit. Checkout and license restoration need a connection.</p><p>Browser data can be cleared by you, your browser, or your device. Keep a JSON export when a ledger matters.</p><h2>Changes</h2><p>We will update the date here when these terms change. Continued use means you accept the changed terms.</p><p><a href="/">Back to Score Ledger</a></p></article>`;
  root.innerHTML = shell(page === "privacy" ? privacy : terms);
}

function renderNotFound(): void {
  setPageTitle("Page not found — Game Night Score Ledger");
  root.innerHTML = shell(`<section class="not-found"><div><p class="eyebrow">404</p><h1>This page does not exist</h1><p>The link may be old or incomplete. Return to your saved ledgers or open the sample.</p><div class="hero-actions"><a class="button" href="/">Return to score ledgers</a><a class="button secondary" href="/demo">Open the sample</a></div></div><img src="/icons/mark.svg" width="180" height="180" alt="" aria-hidden="true"></section>`);
}

function dialog(html: string): HTMLDialogElement {
  const element = document.querySelector<HTMLDialogElement>("#action-dialog");
  if (!element) throw new Error("Dialog not found");
  returnFocus = document.activeElement as HTMLElement;
  element.innerHTML = `<div class="dialog-body">${html}</div>`;
  element.showModal();
  element.querySelector<HTMLElement>("input,button,a")?.focus();
  return element;
}

function closeDialog(): void {
  const element = document.querySelector<HTMLDialogElement>("#action-dialog");
  element?.close();
  returnFocus?.focus();
}

function announce(message: string): void {
  const live = document.querySelector("#live");
  if (live) live.textContent = message;
}

async function persistAndRender(message?: string): Promise<void> {
  if (!currentSession) return;
  const active = document.activeElement as HTMLElement | null;
  const action = active?.dataset.action;
  const player = active?.dataset.player;
  const delta = active?.dataset.delta;
  if (!demoMode) {
    currentSession = await saveConflictSafe(currentSession);
    savedSessions = await listSessions();
  }
  renderSession();
  if (action) {
    const selector = `[data-action="${CSS.escape(action)}"]${player ? `[data-player="${CSS.escape(player)}"]` : ""}${delta ? `[data-delta="${CSS.escape(delta)}"]` : ""}`;
    document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
  }
  if (message) announce(message);
}

function queueSessionMutation(mutate: (session: LedgerSession) => { session: LedgerSession; message?: string }): Promise<void> {
  const operation = sessionMutationQueue.then(async () => {
    if (!currentSession) return;
    const result = mutate(currentSession);
    currentSession = result.session;
    await persistAndRender(result.message);
  });
  // Keep the queue alive after a recoverable input/storage error. Individual
  // callers still receive the rejection and can show their own form feedback.
  sessionMutationQueue = operation.catch(() => undefined);
  return operation;
}

function focusHeading(): void {
  const heading = document.querySelector<HTMLElement>("main h1");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function hostHash(session: LedgerSession): string {
  return `#session=${encodeURIComponent(session.id)}&host=${encodeURIComponent(session.hostKey)}`;
}

async function openSession(id: string): Promise<void> {
  const session = await getSession(id);
  if (!session) { renderError("Ledger not found", "It may have been deleted or saved in a different browser."); return; }
  currentSession = session;
  history.replaceState({}, "", `/${hostHash(session)}`);
  renderSession();
  focusHeading();
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob); const link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "score-ledger"; }

function exportCsv(session: LedgerSession): void {
  const rows = [["timestamp", "round", "player", "team", "change", "running_total", "note"]];
  const totals: Record<string, number> = Object.fromEntries(session.players.map((player) => [player.id, 0]));
  for (const event of session.events) { totals[event.playerId] += event.delta; const player = session.players.find((item) => item.id === event.playerId); rows.push([event.at, String(event.round), player?.name ?? "", player?.team ?? "", String(event.delta), String(totals[event.playerId]), event.note ?? ""]); }
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
  download(`${safeName(session.title)}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

function exportImage(session: LedgerSession): void {
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630;
  const context = canvas.getContext("2d"); if (!context) return;
  context.fillStyle = "#071119"; context.fillRect(0, 0, canvas.width, canvas.height);
  const glow = context.createRadialGradient(970, 100, 10, 970, 100, 500); glow.addColorStop(0, "rgba(103,245,210,.18)"); glow.addColorStop(1, "rgba(7,17,25,0)"); context.fillStyle = glow; context.fillRect(0, 0, 1200, 630);
  context.strokeStyle = "rgba(103,245,210,.45)"; context.lineWidth = 8; context.beginPath(); context.arc(1070, 90, 45, .2, Math.PI * 1.85); context.stroke();
  context.fillStyle = "#67f5d2"; context.font = "700 22px Inter"; context.fillText("GAME NIGHT SCORE LEDGER", 70, 82);
  context.fillStyle = "#f2fbf8"; context.font = "700 54px 'Space Grotesk'"; context.fillText(session.title.slice(0, 34), 70, 155);
  context.fillStyle = "#a9c1c5"; context.font = "400 22px Inter"; context.fillText(`${session.status === "finished" ? "Final score" : `Round ${session.round}`} · ${formatDate(session.updatedAt)}`, 70, 195);
  const scores = scoreMap(session); const ordered = [...session.players].sort((a, b) => scores[b.id] - scores[a.id]);
  ordered.slice(0, 6).forEach((player, index) => { const y = 270 + index * 55; context.fillStyle = index === 0 ? "#ff8c7a" : "#f2fbf8"; context.font = "600 27px Inter"; context.fillText(`${index + 1}. ${player.name}`.slice(0, 34), 82, y); context.textAlign = "right"; context.font = "700 37px 'Space Grotesk'"; context.fillText(String(scores[player.id]), 1080, y); context.textAlign = "left"; });
  context.fillStyle = "#a9c1c5"; context.font = "400 17px Inter"; context.fillText("Auditable · local-first · game-night-score-ledger.sociobot.in", 70, 590);
  canvas.toBlob((blob) => { if (blob) download(`${safeName(session.title)}-score.png`, blob); }, "image/png");
}

async function openShare(): Promise<void> {
  if (!currentSession) return;
  const encoded = encodeSnapshot(makeSnapshot(currentSession));
  const url = `${location.origin}${demoMode ? "/demo" : "/"}#view=${encoded}`;
  const element = dialog(`<div class="dialog-head"><div><p class="eyebrow">Current snapshot</p><h2 id="dialog-title">Guest view</h2><p class="muted">Guests can read this board but cannot edit it. Reshare after new scores.</p></div><button class="icon-button" data-action="close-dialog" aria-label="Close share dialog">×</button></div><div id="qr" class="qr-wrap" role="status" aria-live="polite">Creating QR code…</div><div class="field share-link"><label for="share-url">View-only share link</label><input id="share-url" class="share-url" type="text" readonly value="${escapeHtml(url)}" aria-describedby="share-help"><small id="share-help">Select this link or use Copy link. It contains the point-in-time guest snapshot.</small></div><div class="dialog-actions"><button class="button secondary" data-action="copy-share" data-url="${escapeHtml(url)}">Copy link</button>${"share" in navigator ? `<button class="button" data-action="native-share" data-url="${escapeHtml(url)}">Share</button>` : ""}</div>`);
  try {
    const QRCode = await import("qrcode");
    const canvas = document.createElement("canvas");
    await QRCode.toCanvas(canvas, url, { width: 300, margin: 2, color: { dark: "#071119", light: "#ffffff" }, errorCorrectionLevel: "L" });
    const qr = element.querySelector("#qr"); if (qr) { qr.textContent = ""; canvas.setAttribute("aria-hidden", "true"); qr.append(canvas); qr.setAttribute("role", "img"); qr.setAttribute("aria-label", "QR code for the view-only score snapshot. The share link is available below."); }
  } catch {
    const qr = element.querySelector("#qr"); if (qr) { qr.textContent = "This session is too large for a QR code. Copy the view link instead."; qr.setAttribute("role", "status"); }
  }
}

function openLicense(): void {
  dialog(`<div class="dialog-head"><div><p class="eyebrow">Optional one-time purchase</p><h2 id="dialog-title">Host pack</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close Host pack dialog">×</button></div><div class="license-box"><span class="license-price">$12</span> <strong>one time</strong><p>Host pack adds distraction-free Table view for scores shown across the room. Core scoring, teams, laps, history, accessibility, sharing, and every export stay free.</p>${license.notice ? `<p class="muted" role="status">${escapeHtml(license.notice)}</p>` : ""}${license.unlocked ? `<p class="status-chip">Host pack active</p>` : `<a class="button" href="${checkoutUrl()}">Buy Host pack</a>`}</div><form id="license-form"><div class="field"><label for="license-token">Have a license? Paste it here</label><input id="license-token" name="token" autocomplete="off" spellcheck="false" required><small>Verification needs a connection.</small></div><p class="form-error" id="license-error" role="alert"></p><div class="dialog-actions"><button type="submit" class="button secondary">Restore purchase</button></div></form><p class="muted">Sociobot and Dodo host checkout and handle refunds. A refund revokes the license. <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p>`);
}

root.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  const index = Number(target.dataset.playerIndex);
  const field = target.dataset.field as "name" | "team" | undefined;
  if (field && Number.isInteger(index) && setupPlayers[index]) setupPlayers[index][field] = target.value;
  if (target.id === "game-title") setupDetails.title = target.value;
  if (target.id === "lap-threshold") setupDetails.lap = target.value;
  if (target.id === "increments") setupDetails.increments = target.value;
});

root.addEventListener("change", async (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "teams-toggle") {
    // The toggle changes the shape of the form. Capture the complete draft at
    // that boundary so configuration entered before it is never reset.
    setupDetails.title = document.querySelector<HTMLInputElement>("#game-title")?.value ?? setupDetails.title;
    setupDetails.lap = document.querySelector<HTMLInputElement>("#lap-threshold")?.value ?? setupDetails.lap;
    setupDetails.increments = document.querySelector<HTMLInputElement>("#increments")?.value ?? setupDetails.increments;
    setupTeams = target.checked; renderSetup(); document.querySelector<HTMLInputElement>("#teams-toggle")?.focus({ preventScroll: true });
  }
  if (target.id === "import-file" && target.files?.[0]) {
    try { const imported = validateImported(JSON.parse(await target.files[0].text())); await saveSession(imported); savedSessions = await listSessions(); await openSession(imported.id); announce("Ledger imported as a new editable copy."); }
    catch (error) { renderHome(); announce(error instanceof Error ? error.message : "Could not import that file."); }
  }
});

root.addEventListener("submit", async (event) => {
  event.preventDefault(); const form = event.target as HTMLFormElement;
  if (form.id === "setup-form") {
    const data = new FormData(form);
    setupDetails = {
      title: String(data.get("title") ?? ""),
      lap: String(data.get("lap") ?? ""),
      increments: String(data.get("increments") ?? "")
    };
    const names = setupPlayers.map((player) => player.name.trim()).filter(Boolean);
    if (names.length < 2) { renderSetup("Add at least two player names."); return; }
    if (new Set(names.map((name) => name.toLocaleLowerCase())).size !== names.length) { renderSetup("Give each player a different name so the trail stays clear."); return; }
    const lap = Number(data.get("lap")) || null; if (lap && (lap < 2 || lap > 100000)) { renderSetup("The lap threshold must be between 2 and 100,000."); return; }
    let increments: number[];
    try { increments = parseQuickIncrements(setupDetails.increments); }
    catch (error) { renderSetup(error instanceof Error ? error.message : "Check the quick score buttons.", "increments"); return; }
    const session = createSession({ title: String(data.get("title") ?? ""), players: setupPlayers.filter((p) => p.name.trim()).map((p) => ({ name: p.name, team: setupTeams ? p.team : "" })), lapThreshold: lap, increments });
    currentSession = session; await saveSession(session); savedSessions = await listSessions(); history.replaceState({}, "", `/${hostHash(session)}`); renderSession(); focusHeading(); announce(`${session.title} created and saved on this device.`);
  }
  if (form.id === "custom-score-form" && currentSession) {
    const data = new FormData(form); const playerId = String(data.get("player")); const delta = Number(data.get("delta"));
    try {
      const note = String(data.get("note") ?? "");
      await queueSessionMutation((session) => {
        const next = addScore(session, playerId, delta, note);
        lastChanged = playerId;
        const player = next.players.find((item) => item.id === playerId);
        return { session: next, message: `${signed(delta)} for ${player?.name}.` };
      });
      closeDialog();
    }
    catch (error) { const box = form.querySelector(".form-error"); if (box) box.textContent = error instanceof Error ? error.message : "Enter a valid score change."; }
  }
  if (form.id === "license-form") {
    const box = form.querySelector(".form-error");
    try { restoreLicense(String(new FormData(form).get("token") ?? "")); license = { unlocked: false, checking: true, notice: "Checking license…" }; if (box) box.textContent = "Checking license…"; license = await verifyLicense(true); if (license.unlocked) { closeDialog(); currentSession ? renderSession() : renderHome(); announce("Host pack restored."); } else if (box) box.textContent = license.notice; }
    catch (error) { if (box) box.textContent = error instanceof Error ? error.message : "Could not restore that license."; }
  }
});

root.addEventListener("click", async (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]"); if (!target) return;
  const action = target.dataset.action;
  if (action === "reset-demo" && demoMode) { currentSession = makeDemoSession(); currentSnapshot = null; history.replaceState({}, "", "/demo"); renderSession(); focusHeading(); announce("Sample scores reset."); }
  if (action === "start") { setupPlayers = [{ name: "", team: "" }, { name: "", team: "" }]; setupTeams = false; setupDetails = { title: "Game night", lap: "", increments: "1, 5, 10" }; renderSetup(); setTimeout(() => document.querySelector<HTMLInputElement>("#game-title")?.select()); }
  if (action === "cancel-setup") renderHome();
  if (action === "add-player") { if (setupPlayers.length < 12) setupPlayers.push({ name: "", team: "" }); renderSetup(); setTimeout(() => document.querySelector<HTMLInputElement>(`#player-${setupPlayers.length - 1}`)?.focus()); }
  if (action === "remove-player") { const index = Number(target.dataset.index); if (setupPlayers.length > 2) setupPlayers.splice(index, 1); renderSetup(); }
  if (action === "open-session") await openSession(String(target.dataset.id));
  if (action === "delete-session") { const title = String(target.dataset.title); if (confirm(`Delete “${title}” from this device? Export it first if you need a copy.`)) { await deleteSession(String(target.dataset.id)); savedSessions = await listSessions(); renderHome(); announce(`${title} deleted.`); } }
  if (action === "score" && currentSession) {
    const playerId = String(target.dataset.player); const delta = Number(target.dataset.delta);
    void queueSessionMutation((session) => {
      const next = addScore(session, playerId, delta);
      lastChanged = playerId;
      const player = next.players.find((item) => item.id === playerId);
      return { session: next, message: `${signed(delta)} for ${player?.name}.` };
    }).catch((error) => announce(error instanceof Error ? error.message : "Could not save that score change."));
  }
  if (action === "custom-score" && currentSession) { const player = String(target.dataset.player); const name = String(target.dataset.name); dialog(`<div class="dialog-head"><div><p class="eyebrow">Round ${currentSession.round}</p><h2 id="dialog-title">Adjust ${escapeHtml(name)}</h2></div><button class="icon-button" data-action="close-dialog" aria-label="Close adjustment dialog">×</button></div><form id="custom-score-form"><input type="hidden" name="player" value="${player}"><div class="field"><label for="delta">Score change</label><input id="delta" name="delta" type="number" inputmode="numeric" min="-999999" max="999999" placeholder="Use a minus to subtract" required></div><div class="field" style="margin-top:14px"><label for="note">Note <span class="muted">(optional)</span></label><input id="note" name="note" maxlength="80" placeholder="Bonus, correction, end game…"></div><p class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button ghost" data-action="close-dialog">Cancel</button><button type="submit" class="button">Record change</button></div></form>`); }
  if (action === "undo" && currentSession) await queueSessionMutation((session) => {
    const next = undoLast(session);
    return { session: next, message: next.events.length > session.events.length ? "Last score change reversed. The correction remains in the trail." : undefined };
  });
  if (action === "next-round" && currentSession) await queueSessionMutation((session) => {
    const next = { ...session, round: session.round + 1, updatedAt: new Date().toISOString() };
    return { session: next, message: `Round ${next.round} started.` };
  });
  if (action === "finish" && currentSession && confirm(`Finish “${currentSession.title}”? The ledger stays saved and can be reopened.`)) await queueSessionMutation((session) => ({ session: { ...session, status: "finished", updatedAt: new Date().toISOString() }, message: "Final scores saved." }));
  if (action === "reopen" && currentSession) await queueSessionMutation((session) => ({ session: { ...session, status: "active", updatedAt: new Date().toISOString() }, message: "Ledger reopened." }));
  if (action === "share") await openShare();
  if (action === "export-csv" && currentSession) { exportCsv(currentSession); announce("CSV export downloaded."); }
  if (action === "export-json" && currentSession) { download(`${safeName(currentSession.title)}.json`, new Blob([JSON.stringify(currentSession, null, 2)], { type: "application/json" })); announce("Backup JSON downloaded."); }
  if (action === "export-image" && currentSession) { exportImage(currentSession); announce("Score image downloaded."); }
  if (action === "import") document.querySelector<HTMLInputElement>("#import-file")?.click();
  if (action === "close-dialog") closeDialog();
  if (action === "copy-share") { try { await navigator.clipboard.writeText(String(target.dataset.url)); announce("View-only link copied."); } catch { announce("Could not copy automatically. Select the link in the dialog."); } }
  if (action === "native-share") { try { await navigator.share({ title: currentSession?.title, text: "View the current score", url: String(target.dataset.url) }); } catch { /* user cancelled */ } }
  if (action === "license") openLicense();
  if (action === "table-mode") { if (!license.unlocked) openLicense(); else { document.body.classList.toggle("table-mode"); announce(document.body.classList.contains("table-mode") ? "Table view on. Press Escape to leave." : "Table view off."); } }
  if (action === "reload") await applyServiceWorkerUpdate();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("table-mode")) { document.body.classList.remove("table-mode"); announce("Table view off."); }
});

function updateNetwork(): void {
  const state = document.querySelector(".network-state"); if (!state) return;
  state.classList.toggle("offline", !navigator.onLine); state.innerHTML = `<span>${demoMode ? (navigator.onLine ? "Sample ready" : "Offline sample") : (navigator.onLine ? "Saved locally" : "Offline · saved locally")}</span>`;
}
addEventListener("online", updateNetwork); addEventListener("offline", updateNetwork);

async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    serviceWorkerRegistration = registration;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (applyingServiceWorkerUpdate) location.reload(); });
    const showUpdate = (): void => {
      const toast = document.querySelector<HTMLElement>("#toast"); const text = document.querySelector("#toast-text");
      if (toast && text) { text.textContent = "A fresh ledger version is ready."; toast.hidden = false; }
    };
    if (registration.waiting) showUpdate();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing; if (!worker) return;
      worker.addEventListener("statechange", () => { if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(); });
    });
  } catch { /* the app remains fully usable without installation */ }
}

async function applyServiceWorkerUpdate(): Promise<void> {
  const waiting = serviceWorkerRegistration?.waiting;
  if (waiting) { applyingServiceWorkerUpdate = true; waiting.postMessage("SKIP_WAITING"); return; }
  // The toast is only exposed for an installed update. If it was replaced by a
  // new render before the user tapped, re-check rather than doing a blind reload.
  await serviceWorkerRegistration?.update();
}

async function init(): Promise<void> {
  const page = document.body.dataset.page as "privacy" | "terms" | "404" | undefined;
  if (page === "404") { renderNotFound(); await registerServiceWorker(); return; }
  if (page === "privacy" || page === "terms") { renderLegal(page); await registerServiceWorker(); return; }
  if (demoMode) {
    if (location.pathname !== "/demo") history.replaceState({}, "", `/demo${location.hash}`);
    const hash = new URLSearchParams(location.hash.slice(1));
    try {
      if (hash.has("view")) { currentSnapshot = decodeSnapshot(String(hash.get("view"))); renderSnapshot(); }
      else { currentSession = makeDemoSession(); renderSession(); }
    } catch (error) { renderError("View link is damaged", error instanceof Error ? error.message : "Ask the host to create a new QR code."); }
    await registerServiceWorker();
    return;
  }
  captureLicenseFromUrl();
  savedSessions = await listSessions();
  const hash = new URLSearchParams(location.hash.slice(1));
  try {
    if (hash.has("view")) { currentSnapshot = decodeSnapshot(String(hash.get("view"))); renderSnapshot(); }
    else if (hash.has("session")) {
      const session = await getSession(String(hash.get("session")));
      if (!session) renderError("Ledger not found", "This editable ledger lives only on the host device. Ask for a guest-view QR if you are opening it elsewhere.");
      else if (hash.get("host") !== session.hostKey) renderError("Host key doesn’t match", "This link cannot edit the saved ledger. Open it from Recent ledgers on the host device.");
      else { currentSession = session; renderSession(); }
    } else if (new URLSearchParams(location.search).has("new")) renderSetup();
    else renderHome();
  } catch (error) { renderError("View link is damaged", error instanceof Error ? error.message : "Ask the host to create a new QR code."); }
  await registerServiceWorker();
  if (license.checking) { license = await verifyLicense(); if (currentSession) renderSession(); }
}

if (!demoMode) {
  const channel = new BroadcastChannel("score-ledger");
  channel.addEventListener("message", async (event) => {
    if (currentSession && event.data?.id === currentSession.id && event.data.updatedAt !== currentSession.updatedAt) { const fresh = await getSession(currentSession.id); if (fresh) { currentSession = fresh; renderSession(); announce("Scores updated from another tab."); } }
  });
}

void init();
