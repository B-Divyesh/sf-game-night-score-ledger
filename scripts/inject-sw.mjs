import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

const root = new URL("../dist/", import.meta.url).pathname;
const swPath = join(root, "sw.js");
// Azure Static Web Apps consumes this deployment configuration but does not
// publish it. It must never become a runtime app-shell dependency.
const deploymentOnlyFiles = new Set(["staticwebapp.config.json"]);
const urls = (await walk(root))
  .filter((file) => !file.endsWith("sw.js") && !file.endsWith(".map") && !deploymentOnlyFiles.has(relative(root, file).replaceAll("\\\\", "/")))
  .map((file) => `/${relative(root, file).replaceAll("\\\\", "/")}`)
  .sort();
let source = await readFile(swPath, "utf8");
source = source.replace("/* BUILD_ASSETS */", urls.map((url) => JSON.stringify(url)).join(",\n  "));
const version = createHash("sha256").update(Buffer.concat(await Promise.all(urls.map((url) => readFile(join(root, url.slice(1))))))).digest("hex").slice(0, 16);
source = source.replace("__BUILD_VERSION__", version);
await writeFile(swPath, source);
const manifestPath = join(root, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.start_url = `/?v=${version}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
