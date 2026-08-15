// Find every runtime package the packaged app needs but lacks.
// Walks the dependency+peer closure of the DEV project (which runs fine) and
// reports closure members that do not resolve inside the packaged tree.
// Usage:
//   node scripts/check-packaged-deps.mjs "<dev project root>" "<packaged resources/app>"
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const [devRoot, appRoot] = process.argv.slice(2);
const packagedModules = join(appRoot, "node_modules");
const seen = new Set();
const closure = new Map(); // name -> requested range
const queue = [join(devRoot, "package.json")];

function resolve(name, fromDir) {
  const base = name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name;
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", base);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

while (queue.length > 0) {
  const manifestPath = queue.shift();
  if (seen.has(manifestPath)) continue;
  seen.add(manifestPath);
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    continue;
  }
  // Root manifest: runtime deps only (skip devDependencies like electron).
  const deps = { ...(pkg.dependencies ?? {}) };
  if (manifestPath !== join(devRoot, "package.json")) {
    Object.assign(deps, pkg.peerDependencies ?? {});
  }
  for (const name of Object.keys(deps)) {
    if (!closure.has(name)) closure.set(name, deps[name]);
    const resolved = resolve(name, dirname(manifestPath));
    if (resolved === null) continue; // absent in dev tree too — ignore
    const childManifest = join(resolved, "package.json");
    if (!seen.has(childManifest) && existsSync(childManifest)) queue.push(childManifest);
  }
}

const missing = [];
for (const [name, range] of closure) {
  const resolved = resolve(name, appRoot);
  if (resolved === null) missing.push({ name, range });
}
missing.sort((a, b) => a.name.localeCompare(b.name));
if (missing.length === 0) {
  console.log("OK: the full dev runtime closure resolves inside the packaged tree.");
} else {
  console.log(`MISSING from packaged app (${missing.length}):`);
  for (const { name, range } of missing) console.log(`  ${name}@${range}`);
}
