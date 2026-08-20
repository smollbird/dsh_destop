/**
 * dsh-file-mention — host half.
 *
 * Serves the workspace file tree at /file-mention/list so the browser half
 * can power the '@' candidate menu.
 *
 * The tree root follows the SESSION's workspace: the browser sends the
 * current session id (`?session=<id>`) and the host resolves that session's
 * header `cwd` (live in-memory session store first, then the durable jsonl
 * persistence layer). The desktop shell does NOT spawn the host with
 * cwd = workspace — its process.cwd() points inside the app bundle — so
 * process.cwd() is only the last-resort fallback for session-less calls
 * (legacy behavior). FILE_MENTION_ROOT env forces a fixed root for
 * headless/testing use.
 *
 * Roots always come from session headers — never from query parameters —
 * so the browser cannot inject arbitrary paths.
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
  /** Lowercased extension without dot ("" for no extension / dirs). */
  ext?: string;
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
      const base = entry.name;
      const dot = base.lastIndexOf(".");
      const ext =
        dot > 0 && dot < base.length - 1
          ? base.slice(dot + 1).toLowerCase()
          : "";
      out.push({ path: relPath, kind: "file", ext });
    }
  }
}

/**
 * Minimal structural view of the session layer (avoids a hard dependency on
 * the dsh-session package; live and durable headers share the shape
 * `{ id, cwd? }`).
 */
interface SessionHeaderLike {
  readonly id?: unknown;
  readonly cwd?: unknown;
}
interface SessionStoreLike {
  get?(sessionId: string): { header?: SessionHeaderLike } | undefined;
}
interface SessionPersistenceLike {
  list?(): Promise<readonly SessionHeaderLike[]>;
}

/** Required host services: the web route registry + the session layer for root resolution. */
export const inject = ["webServer", "sessions", "sessionPersistence"];

/** Session id → resolved root (null = unknown). Headers are stable; TTL is generous. */
const rootBySession = new Map<string, { root: string | null; at: number }>();
const ROOT_TTL_MS = 30_000;
const ROOT_CACHE_MAX = 128;

/** (root, depth) → tree snapshot. The menu refetches on every keystroke; keep it hot. */
const treeByKey = new Map<string, { entries: TreeEntry[]; at: number }>();
const TREE_TTL_MS = 3_000;
const TREE_CACHE_MAX = 32;

/**
 * Resolve one session's workspace root: live header first, then the durable
 * layer. null when the session is unknown or carries no cwd (caller falls
 * back). The root only ever comes from session headers — the session id in
 * the query is an indirection, never a path.
 */
async function resolveSessionRoot(ctx: Context, sessionId: string): Promise<string | null> {
  const cached = rootBySession.get(sessionId);
  if (cached !== undefined && Date.now() - cached.at < ROOT_TTL_MS) return cached.root;
  let root: string | null = null;
  try {
    const store = ctx.get("sessions") as SessionStoreLike | undefined;
    const cwd = store?.get?.(sessionId)?.header?.cwd;
    if (typeof cwd === "string" && cwd.length > 0) root = path.resolve(cwd);
  } catch {
    root = null; // live lookup failed — fall through to the durable layer
  }
  if (root === null) {
    try {
      const persistence = ctx.get("sessionPersistence") as SessionPersistenceLike | undefined;
      const headers = await persistence?.list?.();
      const header = headers?.find((h) => h?.id === sessionId);
      const cwd = header?.cwd;
      if (typeof cwd === "string" && cwd.length > 0) root = path.resolve(cwd);
    } catch {
      root = null; // not durable either — caller falls back
    }
  }
  rootBySession.set(sessionId, { root, at: Date.now() });
  if (rootBySession.size > ROOT_CACHE_MAX) {
    let oldestKey: string | undefined;
    let oldestAt = Infinity;
    for (const [k, v] of rootBySession) {
      if (v.at < oldestAt) {
        oldestAt = v.at;
        oldestKey = k;
      }
    }
    if (oldestKey !== undefined) rootBySession.delete(oldestKey);
  }
  return root;
}

/** Depth-capped tree walk with a short per-(root, depth) TTL cache. */
function listTree(root: string, depth: number): TreeEntry[] {
  const key = `${depth}:${root}`;
  const now = Date.now();
  const hit = treeByKey.get(key);
  if (hit !== undefined && now - hit.at < TREE_TTL_MS) return hit.entries;
  const entries: TreeEntry[] = [];
  walkTree(root, "", 0, depth, entries);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  treeByKey.set(key, { entries, at: now });
  if (treeByKey.size > TREE_CACHE_MAX) {
    let oldestKey: string | undefined;
    let oldestAt = Infinity;
    for (const [k, v] of treeByKey) {
      if (v.at < oldestAt) {
        oldestAt = v.at;
        oldestKey = k;
      }
    }
    if (oldestKey !== undefined) treeByKey.delete(oldestKey);
  }
  return entries;
}

/**
 * Mount the /file-mention routes.
 * @param ctx - host context carrying the webServer service.
 */
export function apply(ctx: Context): void {
  const overrideRoot = process.env.FILE_MENTION_ROOT
    ? path.resolve(process.env.FILE_MENTION_ROOT)
    : null;
  const fallbackRoot = process.cwd();

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: "/file-mention",
        handler: async (req, res) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const action = url.pathname.slice("/file-mention".length);
          if (action !== "/list") {
            res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ ok: false, error: "not-found" }));
            return;
          }
          const depthRaw = Number.parseInt(url.searchParams.get("depth") ?? "", 10);
          const depth = Number.isFinite(depthRaw)
            ? Math.min(Math.max(depthRaw, 1), 8)
            : DEFAULT_MAX_DEPTH;
          const sessionId = url.searchParams.get("session");
          const root =
            overrideRoot ??
            (sessionId !== null && sessionId.length > 0
              ? ((await resolveSessionRoot(ctx, sessionId)) ?? fallbackRoot)
              : fallbackRoot);
          const entries = listTree(root, depth);
          const body = JSON.stringify({ ok: true, root, entries });
          res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          res.end(body);
        },
      }),
    "dsh-file-mention: /file-mention routes",
  );
}
