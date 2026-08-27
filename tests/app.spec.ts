import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

test("creates, scores, persists, shares, and works offline", async ({ page, context }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: /Keep every point/ })).toBeVisible();
  await page.getByRole("button", { name: /Start a ledger/ }).click();
  await page.locator("#player-0").fill("Ada");
  await page.locator("#player-1").fill("Bo");
  await page.locator("#lap-threshold").fill("100");
  await page.locator("#teams-toggle").check();
  await page.locator("#team-0").fill("Mint");
  await page.locator("#team-1").fill("Coral");
  await page.getByRole("button", { name: "Create ledger" }).click();

  await page.getByRole("button", { name: "Add 10 points to Ada" }).click();
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("10");
  await expect(page.getByText("Score trail")).toBeVisible();
  await page.reload();
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("10");

  await page.getByRole("button", { name: "Share view" }).click();
  await expect(page.getByRole("img", { name: /QR code for the view-only score snapshot/ })).toBeVisible();
  await expect(page.getByLabel("View-only share link")).toHaveAttribute("readonly", "");
  const shareResults = await new AxeBuilder({ page }).analyze();
  expect(shareResults.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);
  await page.getByRole("button", { name: "Close share dialog" }).click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);

  await context.setOffline(true);
  await expect(page.getByText(/Offline · saved locally/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Game night" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("makes a scannable 12-player QR and keeps guest snapshots noninteractive", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start a ledger/ }).click();
  for (let index = 2; index < 12; index += 1) await page.getByRole("button", { name: "Add player" }).click();
  await page.locator("#teams-toggle").check();
  const names = Array.from({ length: 12 }, (_, index) => `${index}`.padEnd(32, "N"));
  for (const [index, name] of names.entries()) {
    await page.locator(`#player-${index}`).fill(name);
    await page.locator(`#team-${index}`).fill(`${index}`.padEnd(24, "M"));
  }
  await page.getByRole("button", { name: "Create ledger" }).click();
  for (const name of names) await page.getByRole("button", { name: `Add 1 points to ${name}` }).click();
  await page.getByRole("button", { name: "Share view" }).click();
  await expect(page.getByRole("img", { name: /QR code for the view-only score snapshot/ })).toBeVisible();
  const link = await page.getByLabel("View-only share link").inputValue();
  expect(link.length).toBeLessThan(2_400);
  const guest = await context.newPage();
  await guest.goto(link);
  await expect(guest.getByText("View only.")).toBeVisible();
  await expect(guest.getByRole("button", { name: /Adjust score/ })).toHaveCount(0);
  await expect(guest.getByRole("button", { name: /Add .* points/ })).toHaveCount(0);
});

test("keeps keyboard scoring operable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start a ledger/ }).click();
  await page.locator("#player-0").fill("Ada");
  await page.locator("#player-1").fill("Bo");
  await page.getByRole("button", { name: "Create ledger" }).click();
  const score = page.getByRole("button", { name: "Add 1 points to Ada" });
  await score.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("article", { hasText: "Ada" }).locator(".score-number")).toHaveText("1");
});

test("recovers from an invalid stored ledger without exposing or opening it", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("game-night-score-ledger", 1);
    request.onsuccess = () => {
      const transaction = request.result.transaction("sessions", "readwrite");
      transaction.objectStore("sessions").put({ id: "broken", version: 1, players: "not an array" });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  }));
  await page.reload();
  await expect(page.getByRole("heading", { name: /Keep every point/ })).toBeVisible();
  await expect(page.getByText("broken", { exact: true })).toHaveCount(0);
});

test("announces a waiting, versioned service-worker update before reload", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  const source = await page.evaluate(() => fetch("/sw.js", { cache: "no-store" }).then((response) => response.text()));
  expect(source).toMatch(/const CACHE = "score-ledger-[a-f0-9]{16}"/);
  expect(source.slice(source.indexOf('addEventListener("install"'), source.indexOf('addEventListener("activate"'))).not.toContain("skipWaiting");
  const swPath = resolve(process.cwd(), "dist/sw.js");
  await writeFile(swPath, source.replace(/score-ledger-[a-f0-9]{16}/, "score-ledger-0000000000000001"));
  try {
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration?.update(); });
    await expect(page.locator("#toast")).toBeVisible();
    await expect(page.locator("#toast-text")).toHaveText("A fresh ledger version is ready.");
  } finally {
    await writeFile(swPath, source);
  }
});

test("legal pages have one heading and a main landmark", async ({ page }) => {
  for (const path of ["/privacy/", "/terms/"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
  }
});
