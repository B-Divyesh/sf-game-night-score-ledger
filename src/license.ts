const SLUG = "game-night-score-ledger";
const TOKEN_KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${SLUG}`;
const DAY = 86_400_000;

type Verdict = { valid: boolean; reason: string; checkedAt: number };

export type LicenseState = {
  unlocked: boolean;
  checking: boolean;
  notice: string;
};

function baseUrl(): string {
  return (import.meta.env.VITE_BILLING_BASE as string | undefined) || "https://api.sociobot.in";
}

export function checkoutUrl(): string {
  return `${baseUrl()}/api/v1/products/${SLUG}/checkout`;
}

function readVerdict(): Verdict | null {
  try { return JSON.parse(localStorage.getItem(VERDICT_KEY) ?? "null") as Verdict | null; }
  catch { return null; }
}

export function captureLicenseFromUrl(): void {
  const url = new URL(location.href);
  const license = url.searchParams.get("license");
  if (!license) return;
  localStorage.setItem(TOKEN_KEY, license);
  url.searchParams.delete("license");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function initialLicenseState(): LicenseState {
  const token = localStorage.getItem(TOKEN_KEY);
  const verdict = readVerdict();
  return {
    unlocked: Boolean(token && verdict?.valid),
    checking: Boolean(token && (!verdict || Date.now() - verdict.checkedAt >= DAY)),
    notice: ""
  };
}

export async function verifyLicense(force = false): Promise<LicenseState> {
  const token = localStorage.getItem(TOKEN_KEY);
  const cached = readVerdict();
  if (!token) return { unlocked: false, checking: false, notice: "" };
  if (!force && cached && Date.now() - cached.checkedAt < DAY) {
    return { unlocked: cached.valid, checking: false, notice: cached.valid ? "Host pack active" : "License no longer active" };
  }
  try {
    const response = await fetch(`${baseUrl()}/api/v1/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error("Verification service unavailable");
    const data = await response.json() as { valid: boolean; reason: string };
    const verdict = { valid: data.valid, reason: data.reason, checkedAt: Date.now() };
    localStorage.setItem(VERDICT_KEY, JSON.stringify(verdict));
    return { unlocked: data.valid, checking: false, notice: data.valid ? "Host pack restored" : "License no longer active" };
  } catch {
    return { unlocked: Boolean(cached?.valid), checking: false, notice: cached?.valid ? "Host pack available offline" : "Could not verify yet. Check your connection." };
  }
}

export function restoreLicense(token: string): void {
  const clean = token.trim();
  if (!clean) throw new Error("Paste the license token from your receipt.");
  localStorage.setItem(TOKEN_KEY, clean);
  localStorage.removeItem(VERDICT_KEY);
}
