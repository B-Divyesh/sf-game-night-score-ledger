import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
  await expect(page.getByLabel("QR code for a view-only score snapshot")).toBeVisible();
  await page.getByRole("button", { name: "Close share dialog" }).click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["serious", "critical"].includes(item.impact ?? ""))).toEqual([]);

  await context.setOffline(true);
  await expect(page.getByText(/Offline · saved locally/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Game night" })).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test("legal pages have one heading and a main landmark", async ({ page }) => {
  for (const path of ["/privacy/", "/terms/"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("main")).toHaveCount(1);
  }
});
