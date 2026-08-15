/**
 * dsh-settings-tabs — host half.
 *
 * Serves the datasets and mutations the Web Settings tabs render:
 *
 *   GET    /settings-tabs/skills — the skill catalog of the default preset
 *           (`ctx.skills` + `agentPresets.standingKeyFor()`), resolved against
 *           the host process cwd.
 *   GET    /settings-tabs/mcp    — every configured MCP client instance from
 *           the Cordis Loader entries, plus persistence flags.
 *   POST   /settings-tabs/mcp    — quick-add one MCP server: writes the
 *           `- insert:` row into the profile's user patch layer
 *           (`<profile dir>/cordis.patch.yml`) for the next boot AND hot
 *           creates the loader entry so it works immediately (the web
 *           profile ships with HMR disabled, so there is no live watcher;
 *           this mirrors the super-injector's dual-path assembly).
 *   DELETE /settings-tabs/mcp?serverName=… — remove the patch row and, when
 *           the live entry lives at loader root, stop it now. Entries that
 *           came from the patch layer (id contains ":") cannot be removed
 *           live without materializing the whole composed tree into the base
 *           cordis.yml, so those stay until the next restart (the response
 *           reports `pendingRestart: true`).
 *
 * MCP servers are loader plugin instances — NOT settings namespaces — so the
 * quick-add syncs to cordis.patch.yml, never to settings.yaml.
 */
import type { Context } from "@deepseek-ai/cordis";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { IncomingMessage, ServerResponse } from "node:http";
// Type-only imports load the Context augmentations (ctx.webServer / ctx.loader).
import type {} from "@deepseek-ai/dsh-host-webserver";
import type {} from "@deepseek-ai/cordis-plugin-loader";

/** Loader module specifier of the MCP client bridge. */
const MCP_MODULE = "@deepseek-ai/dsh-mcp-client";
/** Valid `serverName`, kept below the public tool-name budget (mirrors dsh-mcp-client). */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/** The user patch layer filename inside a profile directory. */
const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/** Upper bound on accepted JSON bodies. */
const MAX_BODY_BYTES = 64 * 1024;

/** Public projection of one skill catalog row. */
export interface SkillView {
  /** Kebab-case identifier the user references as `/name` in the composer. */
  name: string;
  /** Short routing description. */
  description: string;
  /** Optional extra routing guidance. */
  whenToUse?: string;
  /** Whether the model catalog may invoke the skill. */
  modelInvocable: boolean;
  /** Whether the user may invoke the skill (`/name` in the composer). */
  userInvocable: boolean;
  /** Skill source label (filesystem, runtime, …). */
  source: string;
}

/** Public projection of one configured MCP client instance. */
export interface McpServerView {
  /** Loader entry id (the `mcp-<name>` row at loader root, or `include:…` from the patch layer). */
  entryId: string;
  /** Unique server namespace owning the `mcp__<serverName>__*` tools. */
  serverName: string;
  /** Transport: `stdio` or `streamable-http`. */
  transport: string;
  /** Human-readable target: URL for streamable-http, `command args…` for stdio. */
  target: string;
  /** Whether the loader entry is enabled (never `disabled` in config). */
  enabled: boolean;
  /** Fiber phase label (pending/loading/active/failed/disposed/unloading) or null when unobserved. */
  phase: string | null;
  /** Whether a matching row exists in the profile patch layer (survives restarts). */
  persistent: boolean;
  /** Whether this entry was created by the quick-add (id `mcp-<name>` at loader root). */
  managed: boolean;
}

/** Fiber phase labels mirroring the loader's const enum (0..5). */
const PHASE_LABELS = ["pending", "loading", "active", "failed", "disposed", "unloading"];

/** Minimal structural face of the skill registry's list() (dsh-skill). */
interface SkillRegistryLike {
  list(options?: { cwd?: string; scope?: unknown }): Promise<Array<{
    name: string;
    description: string;
    whenToUse?: string;
    invocation: { modelInvocable: boolean; userInvocable: boolean };
    source: string;
  }>>;
}

/** One row of the profile patch layer (subset of the loader patch vocabulary). */
interface PatchRow {
  id?: string;
  insert?: Array<{
    id?: string;
    name?: string;
    config?: Record<string, unknown>;
  }>;
}

/** One MCP server mutation request body. */
interface McpAddBody {
  serverName?: unknown;
  transport?: unknown;
  command?: unknown;
  args?: unknown;
  url?: unknown;
}

/** Whether a loader module specifier names an MCP client instance. */
function isMcpModule(name: string): boolean {
  return name === MCP_MODULE || /(^|\/|-|:)mcp-client$/.test(name) || name.includes("mcp-client");
}

/** Extract a serverName from a loader entry's raw config. */
function serverNameOf(config: Record<string, unknown> | undefined, entryId: string): string {
  if (typeof config?.serverName === "string" && config.serverName.length > 0) return config.serverName;
  return entryId;
}

/** Required host services: the web route registry and the loader (entry enumeration + hot create/remove). */
export const inject = ["webServer", "loader"];

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(payload);
}

function sendNotFound(res: ServerResponse): void {
  sendJson(res, 404, { ok: false, error: "not-found" });
}

/** The profile's user patch layer: located through the root Include entry's config path. */
function patchFileOf(ctx: Context): { patchPath: string } | undefined {
  const include = [...ctx.loader.entries()].find((entry) => entry.subtree !== undefined);
  if (include === undefined) return undefined;
  const config = include.options.config as { path?: string } | undefined;
  if (typeof config?.path !== "string") return undefined;
  // The include config carries a `file:` URL; normalize to a filesystem path.
  const basePath = config.path.startsWith("file:") ? fileURLToPath(config.path) : config.path;
  return { patchPath: path.join(path.dirname(basePath), PROFILE_PATCH_FILENAME) };
}

/** Read the profile patch layer as rows; a missing/empty file reads as []. */
function readPatchRows(patchPath: string): PatchRow[] {
  let text: string;
  try {
    text = fs.readFileSync(patchPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (text.trim() === "") return [];
  const data = parseYaml(text);
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) throw new Error(`patch file must be a top-level array: ${patchPath}`);
  return data as PatchRow[];
}

/** Preserve the patch file's leading comment/blank header, then dump the rows. */
function writePatchRows(patchPath: string, rows: PatchRow[]): void {
  const raw = fs.readFileSync(patchPath, "utf8");
  const lines = raw.split(/\r?\n/);
  let headerEnd = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      headerEnd += 1;
      continue;
    }
    break;
  }
  const header = lines.slice(0, headerEnd).join("\n");
  const body = rows.length > 0 ? stringifyYaml(rows) : "[]\n";
  fs.writeFileSync(patchPath, `${header.length > 0 ? `${header}\n` : ""}${body}`);
}

/** Whether any patch row inserts an MCP entry with this serverName. */
function patchHasServer(rows: PatchRow[], serverName: string): boolean {
  return rows.some((row) =>
    row.insert?.some((entry) => entry.name === MCP_MODULE && entry.config?.serverName === serverName),
  );
}

/** Remove every insert row whose child names this MCP server. */
function patchRemoveServer(rows: PatchRow[], serverName: string): PatchRow[] {
  return rows.filter(
    (row) => !row.insert?.some((entry) => entry.name === MCP_MODULE && entry.config?.serverName === serverName),
  );
}

/** Build one MCP server view from a loader entry. */
function toMcpView(
  entry: {
    id: string;
    options: { name?: string; config?: unknown };
    disabled: boolean;
    fiber?: { state: number };
  },
  persistent: boolean,
): McpServerView {
  const config = (entry.options.config ?? {}) as Record<string, unknown>;
  const transport = typeof config.transport === "string" ? config.transport : "unknown";
  const serverName = serverNameOf(config, entry.id);
  const target =
    transport === "streamable-http" && typeof config.url === "string"
      ? config.url
      : transport === "stdio" && typeof config.command === "string"
        ? [config.command, ...(Array.isArray(config.args) ? (config.args as string[]) : [])].join(" ")
        : "";
  return {
    entryId: entry.id,
    serverName,
    transport,
    target,
    enabled: !entry.disabled,
    phase: entry.fiber === undefined ? null : PHASE_LABELS[entry.fiber.state] ?? null,
    persistent,
    managed: /(^|:)mcp-[A-Za-z0-9_-]{1,32}$/.test(entry.id),
  };
}

/** Serve GET /settings-tabs/skills — the skill catalog of the default preset. */
async function handleSkills(ctx: Context, res: ServerResponse, debug: boolean): Promise<void> {
  try {
    // Optional service reads (no `inject` requirement): the web composition
    // mounts the skill registry and the agent-presets roster, but this plugin
    // must not fail its whole fiber (and with it the MCP tab) on a deployment
    // without either.
    const skills = ctx.get("skills") as SkillRegistryLike | undefined;
    if (skills === undefined) {
      sendJson(res, 200, { ok: true, skills: [], note: "skill registry absent" });
      return;
    }
    // The host-plane `skill` registry is scope-layered: local discovery
    // (`skill-filesystem`) mounts behind the agent presets, not on the global
    // layer. View through the default preset's standing scope — the same
    // catalog the GUI's sessions see — without composing any agent.
    let scope: unknown;
    const presets = ctx.get("agentPresets") as { standingKeyFor(id?: string): Promise<unknown> } | undefined;
    if (presets !== undefined) {
      try {
        scope = await presets.standingKeyFor();
      } catch {
        scope = undefined;
      }
    }
    const summaries = await skills.list({ cwd: process.cwd(), scope });
    const views: SkillView[] = summaries.map((skill) => ({
      name: skill.name,
      description: skill.description,
      ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
      modelInvocable: skill.invocation.modelInvocable,
      userInvocable: skill.invocation.userInvocable,
      source: skill.source,
    }));
    sendJson(res, 200, { ok: true, skills: views });
  } catch (error) {
    sendJson(res, 200, { ok: false, error: String(error) });
  }
}

/** Serve GET /settings-tabs/mcp — every configured MCP client instance. */
function handleMcpList(ctx: Context, res: ServerResponse): void {
  const patch = patchFileOf(ctx);
  let rows: PatchRow[] = [];
  if (patch !== undefined) {
    try {
      rows = readPatchRows(patch.patchPath);
    } catch {
      rows = [];
    }
  }
  const views: McpServerView[] = [];
  for (const entry of ctx.loader.entries()) {
    const moduleName = entry.options.name ?? "";
    if (!isMcpModule(moduleName)) continue;
    const config = (entry.options.config ?? {}) as Record<string, unknown>;
    const serverName = serverNameOf(config, entry.id);
    views.push(toMcpView(entry, patchHasServer(rows, serverName)));
  }
  // Dedupe: a disabled entry shadowing a live one with the same serverName
  // (post-restart include entry vs. leftover runtime entry) — show the live one.
  const seen = new Set<string>();
  const deduped = views
    .sort((a, b) => Number(a.enabled) - Number(b.enabled))
    .filter((view) => {
      if (seen.has(view.serverName)) return false;
      seen.add(view.serverName);
      return true;
    })
    .sort((a, b) => a.serverName.localeCompare(b.serverName));
  sendJson(res, 200, { ok: true, servers: deduped, patchFile: patch?.patchPath });
}

/** Read a JSON request body with a size cap. */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(new Error(`invalid JSON body: ${String(error)}`));
      }
    });
    req.on("error", reject);
  });
}

/** Serve POST /settings-tabs/mcp — quick-add one MCP server (patch row + live loader entry). */
async function handleMcpAdd(ctx: Context, res: ServerResponse, body: unknown): Promise<void> {
  const patch = patchFileOf(ctx);
  if (patch === undefined) {
    sendJson(res, 200, { ok: false, code: "no-patch-layer", error: "profile patch layer not found" });
    return;
  }
  const input = (body ?? {}) as McpAddBody;
  const serverName = typeof input.serverName === "string" ? input.serverName.trim() : "";
  if (!SERVER_NAME_PATTERN.test(serverName)) {
    sendJson(res, 200, { ok: false, code: "invalid-server-name", error: "serverName must match ^[A-Za-z0-9_-]{1,32}$" });
    return;
  }
  const transport = input.transport === "streamable-http" ? "streamable-http" : input.transport === "stdio" ? "stdio" : "";
  if (transport === "") {
    sendJson(res, 200, { ok: false, code: "invalid-transport", error: "transport must be stdio or streamable-http" });
    return;
  }
  const config: Record<string, unknown> = { transport, serverName };
  if (transport === "stdio") {
    const command = typeof input.command === "string" ? input.command.trim() : "";
    if (command === "") {
      sendJson(res, 200, { ok: false, code: "invalid-command", error: "command is required for stdio transport" });
      return;
    }
    config.command = command;
    config.args = Array.isArray(input.args)
      ? input.args.filter((arg): arg is string => typeof arg === "string" && arg.length > 0)
      : [];
  } else {
    const url = typeof input.url === "string" ? input.url.trim() : "";
    if (!/^https?:\/\/.+/.test(url)) {
      sendJson(res, 200, { ok: false, code: "invalid-url", error: "url must start with http:// or https://" });
      return;
    }
    config.url = url;
  }

  // Uniqueness: live loader entries first, then existing patch rows.
  const entryId = `mcp-${serverName}`;
  for (const entry of ctx.loader.entries()) {
    const moduleName = entry.options.name ?? "";
    if (!isMcpModule(moduleName)) continue;
    const existing = serverNameOf((entry.options.config ?? {}) as Record<string, unknown>, entry.id);
    if (existing === serverName) {
      sendJson(res, 200, { ok: false, code: "duplicate", error: `MCP server "${serverName}" already exists` });
      return;
    }
  }
  let rows: PatchRow[] = [];
  try {
    rows = readPatchRows(patch.patchPath);
  } catch (error) {
    sendJson(res, 200, {
      ok: false,
      code: "patch-unreadable",
      error: `cannot parse ${patch.patchPath}: ${String(error)} (the quick-add cannot rewrite a file with !!js expressions — edit it manually)`,
    });
    return;
  }
  if (patchHasServer(rows, serverName)) {
    sendJson(res, 200, { ok: false, code: "duplicate", error: `MCP server "${serverName}" already exists` });
    return;
  }
  try {
    rows.push({ insert: [{ id: entryId, name: MCP_MODULE, config }] });
    writePatchRows(patch.patchPath, rows);
    // The typed signature omits `id` (EntryTree.create assigns one itself via
    // ensureId when absent), but the runtime honors a caller-supplied id —
    // we need the stable `mcp-<serverName>` id for delete and restart parity.
    await ctx.loader.create({ id: entryId, name: MCP_MODULE, config } as never);
  } catch (error) {
    sendJson(res, 200, { ok: false, code: "apply-failed", error: String(error) });
    return;
  }
  sendJson(res, 200, {
    ok: true,
    server: {
      entryId,
      serverName,
      transport,
      target:
        transport === "stdio"
          ? [config.command, ...(config.args as string[])].join(" ")
          : (config.url as string),
      persistent: true,
      managed: true,
      note: `synced to ${patch.patchPath}`,
    },
  });
}

/** Serve DELETE /settings-tabs/mcp?serverName=… — remove the patch row and stop the live entry when possible. */
async function handleMcpRemove(ctx: Context, res: ServerResponse, serverName: string): Promise<void> {
  const patch = patchFileOf(ctx);
  let pendingRestart = false;
  if (patch !== undefined) {
    try {
      const rows = patchRemoveServer(readPatchRows(patch.patchPath), serverName);
      writePatchRows(patch.patchPath, rows);
    } catch (error) {
      sendJson(res, 200, { ok: false, code: "patch-unreadable", error: String(error) });
      return;
    }
  }
  for (const entry of ctx.loader.entries()) {
    const moduleName = entry.options.name ?? "";
    if (!isMcpModule(moduleName)) continue;
    const existing = serverNameOf((entry.options.config ?? {}) as Record<string, unknown>, entry.id);
    if (existing !== serverName) continue;
    if (entry.id.includes(":")) {
      // Patch-layer entry inside the include tree: removing it live would
      // materialize the whole composed tree into the base cordis.yml — skip.
      pendingRestart = true;
      continue;
    }
    try {
      await ctx.loader.remove(entry.id);
    } catch (error) {
      sendJson(res, 200, { ok: false, code: "remove-failed", error: String(error) });
      return;
    }
  }
  sendJson(res, 200, { ok: true, pendingRestart });
}

/**
 * Mount the /settings-tabs routes.
 * @param ctx - host context carrying the webServer and loader services.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: "/settings-tabs",
        handler: async (req: IncomingMessage, res: ServerResponse) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          const action = url.pathname.slice("/settings-tabs".length);
          try {
            if (action === "/skills" && (req.method === "GET" || req.method === "HEAD")) {
              void handleSkills(ctx, res, url.searchParams.get("debug") === "1");
              return;
            }
            if (action === "/mcp") {
              if (req.method === "GET" || req.method === "HEAD") {
                handleMcpList(ctx, res);
                return;
              }
              if (req.method === "POST") {
                let body: unknown;
                try {
                  body = await readJsonBody(req);
                } catch (error) {
                  sendJson(res, 200, { ok: false, code: "bad-body", error: String(error) });
                  return;
                }
                await handleMcpAdd(ctx, res, body);
                return;
              }
              if (req.method === "DELETE") {
                const serverName = url.searchParams.get("serverName") ?? "";
                await handleMcpRemove(ctx, res, serverName);
                return;
              }
            }
            sendNotFound(res);
          } catch (error) {
            sendJson(res, 200, { ok: false, code: "internal", error: String(error) });
          }
        },
      }),
    "dsh-settings-tabs: /settings-tabs routes",
  );
}
