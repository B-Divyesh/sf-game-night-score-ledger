import { readdir, readFile, writeFile } from "node:fs/promises";
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
const urls = (await walk(root))
  .filter((file) => !file.endsWith("sw.js") && !file.endsWith(".map"))
  .map((file) => `/${relative(root, file).replaceAll("\\\\", "/")}`)
  .sort();
let source = await readFile(swPath, "utf8");
source = source.replace("/* BUILD_ASSETS */", urls.map((url) => JSON.stringify(url)).join(",\n  "));
await writeFile(swPath, source);
