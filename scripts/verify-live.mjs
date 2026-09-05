import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { writeFile } from "node:fs/promises";

const origin = process.argv[2] || "https://game-night-score-ledger.sociobot.in";
const evidenceDir = process.argv[3] || "/work/.evidence";
const devices = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
];

const browser = await chromium.launch({ headless: true });
const report = [];

for (const device of devices) {
  const context = await browser.newContext(device);
  const page = await context.newPage();
  const errors = [];
  const requestOrigins = new Set();
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("request", (request) => requestOrigins.add(new URL(request.url()).origin));

  await page.goto(`${origin}/`, { waitUntil: "networkidle" });
  const firstScreen = {
    title: await page.title(),
    job: await page.locator("h1").innerText(),
    audience: await page.locator(".hero-copy > p:not(.eyebrow):not(.action-note)").innerText(),
    firstAction: await page.getByRole("link", { name: "Try it with sample data" }).innerText(),
    noHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  };
  await page.screenshot({ path: `${evidenceDir}/live-${device.name}-initial.png`, fullPage: false });

  await page.evaluate(() => {
    localStorage.setItem("score-ledger:live-canary", "unchanged");
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("game-night-score-ledger", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("sessions", { keyPath: "id" });
      request.onsuccess = () => {
        const transaction = request.result.transaction("sessions", "readwrite");
        transaction.objectStore("sessions").put({ id: "live-real-canary", marker: "unchanged" });
        transaction.oncomplete = () => { request.result.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
      request.onerror = () => reject(request.error);
    });
  });

  await page.getByRole("link", { name: "Try it with sample data" }).click();
  await page.getByText("Demo — sample data, nothing is saved").waitFor();
  await page.getByRole("heading", { name: "Saturday strategy final" }).waitFor();
  const initialScore = await page.locator("article", { hasText: "Maya" }).locator(".score-number").innerText();
  const scoreButton = page.getByRole("button", { name: "Add 10 points to Maya" });
  await scoreButton.focus();
  const focus = await scoreButton.evaluate((button) => {
    const style = getComputedStyle(button);
    return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
  });
  await page.keyboard.press("Enter");
  await page.locator("article", { hasText: "Maya" }).locator(".score-number").getByText("152", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.locator("article", { hasText: "Maya" }).locator(".score-number").getByText("142", { exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotionDuration = await page.getByRole("button", { name: "Add 1 points to Maya" }).evaluate((button) => getComputedStyle(button).transitionDuration);

  const isolation = await page.evaluate(() => new Promise((resolve, reject) => {
    const localCanary = localStorage.getItem("score-ledger:live-canary");
    const request = indexedDB.open("game-night-score-ledger", 1);
    request.onsuccess = () => {
      const transaction = request.result.transaction("sessions", "readonly");
      const get = transaction.objectStore("sessions").get("live-real-canary");
      get.onsuccess = () => { request.result.close(); resolve({ localCanary, record: get.result }); };
      get.onerror = () => reject(get.error);
    };
    request.onerror = () => reject(request.error);
  }));

  const axe = await new AxeBuilder({ page }).analyze();
  const seriousAxe = axe.violations.filter((item) => ["serious", "critical"].includes(item.impact || ""));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
  await page.reload({ waitUntil: "networkidle" });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Saturday strategy final" }).waitFor();
  const offlineLabel = await page.getByText("Offline sample").isVisible();
  await page.screenshot({ path: `${evidenceDir}/live-${device.name}-demo.png`, fullPage: false });
  await context.setOffline(false);

  report.push({
    device: device.name,
    firstScreen,
    sample: {
      banner: "Demo — sample data, nothing is saved",
      playerRows: await page.locator(".score-row").count(),
      initialMayaScore: initialScore,
      resetMayaScore: await page.locator("article", { hasText: "Maya" }).locator(".score-number").innerText(),
      realDataCanary: isolation,
      offlineReload: offlineLabel,
      keyboardScore: true,
      focus,
      reducedMotionDuration
    },
    seriousOrCriticalAxe: seriousAxe,
    requestOrigins: [...requestOrigins],
    errors
  });
  await context.close();
}

await browser.close();
await writeFile(`${evidenceDir}/live-cold-browser.json`, `${JSON.stringify(report, null, 2)}\n`);

for (const item of report) {
  if (item.errors.length || item.seriousOrCriticalAxe.length || !item.firstScreen.noHorizontalOverflow || !item.sample.offlineReload || item.sample.playerRows !== 4 || item.sample.initialMayaScore !== "142" || item.sample.resetMayaScore !== "142" || item.sample.realDataCanary.localCanary !== "unchanged" || item.sample.realDataCanary.record?.marker !== "unchanged" || item.sample.focus.width !== "3px" || !["0.00001s", "1e-05s"].includes(item.sample.reducedMotionDuration) || item.requestOrigins.some((value) => value !== origin)) {
    process.exitCode = 1;
  }
}

console.log(JSON.stringify(report, null, 2));
