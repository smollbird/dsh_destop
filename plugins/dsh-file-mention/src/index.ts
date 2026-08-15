/**
 * dsh-file-mention — host half.
 *
 * Serves the workspace file tree at /file-mention/list so the browser half
 * can power the '@' candidate menu. The tree root follows the host process
 * cwd (the desktop shell spawns `dsh web` with cwd = workspace root), so
 * '@plan.md' resolves against the same tree the agent's read/glob tools see.
 * FILE_MENTION_ROOT env overrides the root when needed.
 */
import fs from "node:fs";
import path from "node:path";
import type { Context } from "@deepseek-ai/cordis";
// Type import loads the @deepseek-ai/cordis Context augmentation (ctx.webServer).
import type {} from "@deepseek-ai/dsh-host-webserver";

/** Directories never offered as '@' candidates (build/packaging noise). */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-electron",
  "logs",
  "vendor",
  "coverage",
]);

const MAX_ENTRIES = 2000;
const DEFAULT_MAX_DEPTH = 3;

/** One candidate tree row: a file or a directory (trailing "/"). */
export interface TreeEntry {
  path: string;
  kind: "file" | "dir";
}

/**
 * Collect relative paths under `dir` (posix separators), depth-capped.
 * Directories are collected as candidates too (path ends with "/") so the
 * menu can offer `@dir/` references and let further typing filter inside.
 */
function walkTree(dir: string, rel: string, depth: number, maxDepth: number, out: TreeEntry[]): void {
  if (out.length >= MAX_ENTRIES || depth > maxDepth) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable subtree — skip, never fail the listing
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // dotfiles: hidden
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    if (entry.name.endsWith(".iconset")) continue; // icon asset dirs
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push({ path: `${relPath}/`, kind: "dir" });
      walkTree(path.join(dir, entry.name), relPath, depth + 1, maxDepth, out);
    } else if (entry.isFile()) {
      out.push({ path: relPath, kind: "file" });
    }
  }
}

/** Required host services: the web route registry. */
export const inject = ["webServer"];

/**
 * Mount the /file-mention routes.
 * @param ctx - host context carrying the webServer service.
 */
export function apply(ctx: Context): void {
  const root = process.env.FILE_MENTION_ROOT
    ? path.resolve(process.env.FILE_MENTION_ROOT)
    : process.cwd();

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: "/file-mention",
        handler: (req, res) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const action = url.pathname.slice("/file-mention".length);
          if (action === "/list") {
            const depthRaw = Number.parseInt(url.searchParams.get("depth") ?? "", 10);
            const depth = Number.isFinite(depthRaw)
              ? Math.min(Math.max(depthRaw, 1), 8)
              : DEFAULT_MAX_DEPTH;
            const entries: TreeEntry[] = [];
            walkTree(root, "", 0, depth, entries);
            entries.sort((a, b) => a.path.localeCompare(b.path));
            const body = JSON.stringify({ ok: true, root, entries });
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(body);
            return;
          }
          res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ ok: false, error: "not-found" }));
        },
      }),
    "dsh-file-mention: /file-mention routes",
  );
}
