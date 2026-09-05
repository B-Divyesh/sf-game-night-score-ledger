import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

async function openDemo(page: Page): Promise<void> {
  await page.goto("/demo");
  await expect(page.getByText("Demo — sample data, nothing is saved")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saturday strategy final" })).toBeVisible();
}

async function startRealLedger(page: Page, names: string[] = ["Ada", "Bo"]): Promise<void> {
  await openDemo(page);
  await page.getByRole("link", { name: "Start for real" }).click();
  for (let index = 2; index < names.length; index += 1) await page.getByRole("button", { name: "Add player" }).click();
  for (const [index, name] of names.entries()) await page.locator(`#player-${index}`).fill(name);
  await page.getByRole("button", { name: "Create ledger" }).click();
  await expect(page.getByRole("heading", { name: "Game night" })).toBeVisible();
  await expect(page).toHaveURL(/#session=/);
}

async function putRealCanary(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("game-night-score-ledger", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("sessions", { keyPath: "id" });
    request.onsuccess = () => {
      const transaction = request.result.transaction("sessions", "readwrite");
      transaction.objectStore("sessions").put({ id: "real-canary", marker: "do-not-touch" });
      transaction.oncomplete = () => { request.result.close(); resolve(); };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  }));
}

async function readRealCanary(page: Page): Promise<unknown> {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("game-night-score-ledger", 1);
    request.onsuccess = () => {
      const transaction = request.result.transaction("sessions", "readonly");
      const get = transaction.objectStore("sessions").get("real-canary");
      get.onsuccess = () => { request.result.close(); resolve(get.result); };
      get.onerror = () => reject(get.error);
    };
    request.onerror = () => reject(request.error);
  }));
}

test("@claim:demo-sandbox opens populated sample, resets it, and leaves real data unchanged", async ({ page }) => {
  await page.goto("/");
  await putRealCanary(page);
  await page.getByRole("link", { name: "Try it with sample data" }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.locator(".history-list .event")).toHaveCount(8);
  await page.getByRole("button", { name: "Add 10 points to Maya" }).click();
  await expect(page.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("152");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("142");
  await expect(readRealCanary(page)).resolves.toEqual({ id: "real-canary", marker: "do-not-touch" });
});

test("@claim:offline-reload reloads the sample without a network", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openDemo(page);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Saturday strategy final" })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Saturday strategy final" })).toBeVisible();
  await expect(page.getByText("Offline sample")).toBeVisible();
  await context.close();
});

test("@claim:local-private sends no score data to another origin", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openDemo(page);
  await page.getByRole("button", { name: "Add 5 points to Theo" }).click();
  await page.getByRole("button", { name: "Share view" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  expect(requests.every((url) => new URL(url).origin === "http://127.0.0.1:4173")).toBe(true);
  expect(requests.some((url) => url.includes("api.sociobot.in"))).toBe(false);
});

test("@claim:no-account scores the sample without an account or sign-in", async ({ page }) => {
  await openDemo(page);
  await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Add 1 points to Jonah" }).click();
  await expect(page.locator("article", { hasText: "Jonah" }).locator(".score-number")).toHaveText("74");
});

test("@claim:players-2-12 creates ledgers at both player-count boundaries", async ({ browser }) => {
  const twoContext = await browser.newContext();
  const twoPage = await twoContext.newPage();
  await startRealLedger(twoPage, ["Ada", "Bo"]);
  await expect(twoPage.locator(".score-row")).toHaveCount(2);
  await twoContext.close();

  const twelveContext = await browser.newContext();
  const twelvePage = await twelveContext.newPage();
  await startRealLedger(twelvePage, Array.from({ length: 12 }, (_, index) => `Player ${index + 1}`));
  await expect(twelvePage.locator(".score-row")).toHaveCount(12);
  await expect(twelvePage.getByText("12 players")).toBeVisible();
  await twelveContext.close();
});

test("@claim:lap-tracking shows wrapped laps and track position", async ({ page }) => {
  await openDemo(page);
  const maya = page.locator("article", { hasText: "Maya" });
  await expect(maya.getByText("1 lap · position 42 of 100")).toBeVisible();
  await page.getByRole("button", { name: "Add 10 points to Maya" }).click();
  await expect(maya.getByText("1 lap · position 52 of 100")).toBeVisible();
});

test("@claim:team-totals calculates totals from all team members", async ({ page }) => {
  await openDemo(page);
  await expect(page.locator(".team-total", { hasText: "Cedar" }).locator("strong")).toHaveText("267");
  await expect(page.locator(".team-total", { hasText: "Coral" }).locator("strong")).toHaveText("174");
});

test("@claim:audit-trail records a scored change with round and player", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Add 5 points to Theo" }).click();
  await expect(page.locator(".history-list .event")).toHaveCount(9);
  const newest = page.locator(".history-list .event").first();
  await expect(newest).toContainText("Theo");
  await expect(newest).toContainText("+5");
  await expect(newest).toContainText("Round 3");
});

test("@claim:undo-audit reverses a score without deleting the original event", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Add 10 points to Maya" }).click();
  await page.getByRole("button", { name: "Undo last" }).click();
  await expect(page.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("142");
  await expect(page.locator(".history-list .event")).toHaveCount(10);
  await expect(page.locator(".history-list .event").first()).toContainText("Undo +10 for Maya");
});

test("@claim:rapid-score records every rapid tap", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Add 1 points to Maya" }).evaluate((button) => {
    for (let index = 0; index < 10; index += 1) button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("152");
  await expect(page.locator(".history-list .event")).toHaveCount(18);
});

test("@claim:multi-tab-merge keeps score events made in two host tabs", async ({ page, context }) => {
  await startRealLedger(page);
  const hostUrl = page.url();
  const second = await context.newPage();
  await second.goto(hostUrl);
  await page.getByRole("button", { name: "Add 1 points to Ada" }).click();
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("1");
  await second.evaluate(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="score"][data-delta="5"]')).find((button) => button.getAttribute("aria-label")?.includes("Bo"))?.click());
  await expect(second.locator("article", { hasText: "Bo" }).locator(".score-number")).toHaveText("5");
  await expect(page.locator(".history-list .event")).toHaveCount(2);
  await page.reload();
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("1");
  await expect(page.locator("article", { hasText: "Bo" }).locator(".score-number")).toHaveText("5");
  await expect(page.locator(".history-list .event")).toHaveCount(2);
});

test("@claim:qr-view-only opens a guest snapshot with no edit controls", async ({ page, context }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Share view" }).click();
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  const link = await page.getByLabel("View-only share link").inputValue();
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(guest.getByText("View only.")).toBeVisible();
  await expect(guest.getByRole("button", { name: /Add .* points|Adjust score/ })).toHaveCount(0);
  await expect(guest.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("142");
  await page.getByRole("button", { name: "Close share dialog" }).click();
  await page.getByRole("button", { name: "Add 25 points to Maya" }).click();
  await expect(page.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("167");
  await expect(guest.locator("article", { hasText: "Maya" }).locator(".score-number")).toHaveText("142");
});

test("@claim:csv-export downloads one CSV row per score event", async ({ page }) => {
  await openDemo(page);
  const download = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]).then(([item]) => item);
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path!, "utf8");
  const rows = csv.trim().split(/\r?\n/);
  expect(rows).toHaveLength(9);
  expect(rows[0]).toBe('"timestamp","round","player","team","change","running_total","note"');
  expect(csv).toContain('"Maya","Cedar","62"');
});

test("@claim:png-export downloads a valid 1200 by 630 score image", async ({ page }) => {
  await openDemo(page);
  const download = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save image" }).click()]).then(([item]) => item);
  const path = await download.path();
  expect(path).not.toBeNull();
  const metadata = await sharp(path!).metadata();
  expect(metadata.format).toBe("png");
  expect(metadata.width).toBe(1200);
  expect(metadata.height).toBe(630);
});

test("@claim:json-backup-import exports the sample and imports an editable copy", async ({ page }) => {
  await openDemo(page);
  const download = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export backup JSON" }).click()]).then(([item]) => item);
  const path = await download.path();
  expect(path).not.toBeNull();
  const backup = JSON.parse(await readFile(path!, "utf8")) as { title: string; players: unknown[]; events: unknown[] };
  expect(backup.title).toBe("Saturday strategy final");
  expect(backup.players).toHaveLength(4);
  expect(backup.events).toHaveLength(8);

  await page.getByRole("link", { name: "Start for real" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Import/ }).click();
  await (await chooser).setFiles(path!);
  await expect(page.getByRole("heading", { name: "Saturday strategy final" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add 1 points to Maya" })).toBeVisible();
});

test("@claim:pwa-installable provides a controlled standalone app shell", async ({ page }) => {
  await openDemo(page);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  const manifest = await page.evaluate(() => fetch("/manifest.webmanifest").then((response) => response.json())) as { display: string; start_url: string; icons: Array<{ sizes: string; purpose: string }> };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toMatch(/^\/\?v=[a-f0-9]{16}$/);
  expect(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable")).toBe(true);
});

test("@claim:saved-reload keeps a real ledger and its score after reload", async ({ page }) => {
  await startRealLedger(page);
  await page.getByRole("button", { name: "Add 10 points to Ada" }).click();
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("10");
  await page.reload();
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("10");
  await expect(page.locator(".history-list .event")).toHaveCount(1);
});

test("@claim:free-core scores and exports without a license", async ({ page }) => {
  await openDemo(page);
  await expect(page.getByRole("button", { name: "Add 25 points to Priya" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Share view" })).toBeVisible();
  const download = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]).then(([item]) => item);
  expect(await download.path()).not.toBeNull();
});

test("@claim:host-pack-one-time shows the exact price, paid feature, and checkout route", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: /Table view/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Host pack" })).toBeVisible();
  await expect(dialog).toContainText("$12");
  await expect(dialog).toContainText("one time");
  await expect(dialog).toContainText("Table view");
  await expect(dialog.getByRole("link", { name: "Buy Host pack" })).toHaveAttribute("href", "https://api.sociobot.in/api/v1/products/game-night-score-ledger/checkout");
  await expect(dialog).toContainText("every export stay free");
  await expect(dialog.locator('input[autocomplete="cc-number"], input[name*="card"]')).toHaveCount(0);
});

test("@claim:license-local sends a restored license only to Sociobot and stores it locally", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("link", { name: "Start for real" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  let verificationUrl = "";
  await page.route("https://api.sociobot.in/api/v1/products/game-night-score-ledger/verify?**", async (route) => {
    verificationUrl = route.request().url();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true, reason: "ok" }) });
  });
  await page.getByRole("button", { name: "Host pack and license" }).click();
  await page.getByLabel("Have a license? Paste it here").fill("claim-test-license");
  await page.getByRole("button", { name: "Restore purchase" }).click();
  await expect.poll(() => verificationUrl).toContain("api.sociobot.in/api/v1/products/game-night-score-ledger/verify?license=claim-test-license");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sb_license:game-night-score-ledger"))).toBe("claim-test-license");
});

test("@claim:license-revocation locks Table view after a revoked verification result", async ({ page }) => {
  await openDemo(page);
  await page.evaluate(() => {
    localStorage.setItem("sb_license:game-night-score-ledger", "cached-license");
    localStorage.setItem("sb_license_verdict:game-night-score-ledger", JSON.stringify({ valid: true, reason: "ok", checkedAt: Date.now() }));
  });
  await page.getByRole("link", { name: "Start for real" }).click();
  await page.locator("#player-0").fill("Ada");
  await page.locator("#player-1").fill("Bo");
  await page.getByRole("button", { name: "Create ledger" }).click();
  await expect(page).toHaveURL(/#session=/);
  await page.getByRole("button", { name: /^Table view/ }).click();
  await expect(page.locator("body")).toHaveClass(/table-mode/);
  await page.keyboard.press("Escape");
  await page.route("https://api.sociobot.in/api/v1/products/game-night-score-ledger/verify?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: false, reason: "revoked" }) }));
  await page.getByRole("button", { name: "Host pack and license" }).click();
  await page.getByLabel("Have a license? Paste it here").fill("revoked-license");
  await page.getByRole("button", { name: "Restore purchase" }).click();
  await expect(page.locator("#license-error")).toHaveText("License no longer active");
  await page.getByRole("button", { name: "Close Host pack dialog" }).click();
  await page.getByRole("button", { name: /^Table view/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/table-mode/);
});

test("@claim:data-delete removes a saved ledger from the browser", async ({ page }) => {
  await startRealLedger(page);
  await page.getByRole("link", { name: "Game Night Score Ledger home" }).click();
  await expect(page.getByRole("heading", { name: "Game night" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: "No saved ledgers yet" })).toBeVisible();
  const count = await page.evaluate(() => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open("game-night-score-ledger", 1);
    request.onsuccess = () => {
      const transaction = request.result.transaction("sessions", "readonly");
      const countRequest = transaction.objectStore("sessions").count();
      countRequest.onsuccess = () => { request.result.close(); resolve(countRequest.result); };
      countRequest.onerror = () => reject(countRequest.error);
    };
    request.onerror = () => reject(request.error);
  }));
  expect(count).toBe(0);
});
