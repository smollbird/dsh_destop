/**
 * dsh-settings-tabs — external agent sync sources.
 *
 * Read-only discovery + one-shot import helpers for the "sync other agents"
 * feature of the Skills and MCP settings tabs:
 *
 *   - skill directories of Claude / Codex / OpenCode / Cursor / the shared
 *     `.agents/skills` home (all use the same `<dir>/<name>/SKILL.md` layout);
 *   - MCP server configs from Claude (~/.claude.json), OpenCode
 *     (~/.config/opencode/opencode.json), Codex (~/.codex/config.toml) and
 *     Cursor (~/.cursor/mcp.json).
 *
 * Skill install = a symlink into `~/.dsh/skills` (the root dsh-skill-filesystem
 * already scans); uninstall = symlink removal. MCP install is handled by the
 * existing /settings-tabs/mcp POST (patch row + hot loader entry); the
 * normalizer here only converts foreign formats to the payload shape.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* skills                                                             */
/* ------------------------------------------------------------------ */

/** Skill roots of external agents, in stable display order. */
const EXTERNAL_SKILL_ROOTS: Array<{ agent: string; dir: string }> = [
  { agent: "claude", dir: path.join(os.homedir(), ".claude", "skills") },
  { agent: "codex", dir: path.join(os.homedir(), ".codex", "skills") },
  { agent: "opencode", dir: path.join(os.homedir(), ".config", "opencode", "skills") },
  { agent: "cursor", dir: path.join(os.homedir(), ".cursor", "skills-cursor") },
  { agent: "agents", dir: path.join(os.homedir(), ".agents", "skills") },
];

/** The project-scoped `.agent`/`.agents` roots (DSH's own skill-filesystem
 *  roots at the host process cwd), plus a user-level `~/.agent/skills` for
 *  parity with the `.agents` home root. Computed lazily so the cwd is read
 *  at call time (the web host may chdir before this plugin's routes run). */
function projectSkillRoots(): Array<{ agent: string; dir: string }> {
  const cwd = process.cwd();
  const home = os.homedir();
  const roots: Array<{ agent: string; dir: string }> = [];
  // User-level .agent (mirror of ~/.agents/skills) — only when distinct.
  const homeAgent = path.join(home, ".agent", "skills");
  if (homeAgent !== path.join(home, ".agents", "skills")) roots.push({ agent: "agent", dir: homeAgent });
  // Project-level .agent / .agents (the same roots dsh-skill-filesystem scans).
  roots.push({ agent: "agent(project)", dir: path.join(cwd, ".agent", "skills") });
  roots.push({ agent: "agents(project)", dir: path.join(cwd, ".agents", "skills") });
  return roots;
}

/** One skill discovered in an external agent directory. */
export interface ExternalSkill {
  /** Which agent directory the skill was found in. */
  agent: string;
  /** Directory (skill folder) the skill lives in. */
  agentDir: string;
  /** Skill folder name (becomes the DSH skill name). */
  name: string;
  /** Absolute path of the skill folder. */
  dir: string;
  /** SKILL.md frontmatter description, if present. */
  description: string;
  /** Whether a DSH install location for this skill already exists. */
  installed: boolean;
}

/** Minimal frontmatter reader: the leading `---` block of a SKILL.md. */
function readFrontmatter(file: string): Record<string, string> {
  const result: Record<string, string> = {};
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return result;
  }
  if (!text.startsWith("---")) return result;
  const end = text.indexOf("\n---", 3);
  if (end === -1) return result;
  const lines = text.slice(3, end).split(/\r?\n/);
  const unquote = (value: string): string => value.replace(/^["']|["']$/g, "");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
    if (match === null || match[1] === undefined) continue;
    const key = match[1];
    const value = (match[2] ?? "").trim();
    if (value === "" || value === ">" || value === ">-" || value === ">" || value === "|" || value === "|-") {
      // folded/literal block scalar: gather the indented lines that follow.
      const parts: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? "";
        if (/^\S/.test(next)) break;
        parts.push(next.trim());
      }
      result[key] = parts.filter((part) => part.length > 0).join(" ");
      continue;
    }
    result[key] = unquote(value);
  }
  return result;
}

/** Resolve `~/.dsh/skills` (or the env override) without touching the loader. */
export function dshSkillRoot(): string {
  return path.join(process.env.DSH_HOME ?? path.join(os.homedir(), ".dsh"), "skills");
}

/** Whether a DSH skill with this name is already present (symlink or directory). */
export function isSkillInstalled(name: string): boolean {
  return fs.existsSync(path.join(dshSkillRoot(), name));
}

/** Scan every external skill root; missing roots are skipped silently. */
export function listExternalSkills(): ExternalSkill[] {
  const found = new Map<string, ExternalSkill>();
  const roots = [...EXTERNAL_SKILL_ROOTS, ...projectSkillRoots()];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = fs.readdirSync(root.dir);
    } catch {
      continue;
    }
    for (const entry of entries.sort()) {
      const dir = path.join(root.dir, entry);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(dir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      const skillFile = path.join(dir, "SKILL.md");
      if (!fs.existsSync(skillFile)) continue;
      // First occurrence wins: stable root order, no agent listed twice for
      // the same skill name (symlink farms share one origin).
      if (found.has(entry)) continue;
      const fm = readFrontmatter(skillFile);
      found.set(entry, {
        agent: root.agent,
        agentDir: root.dir,
        name: entry,
        dir,
        description: fm["description"] ?? "",
        installed: isSkillInstalled(entry),
      });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Install one external skill as a symlink into the DSH skill root. */
export function installSkill(name: string): { ok: boolean; error?: string } {
  const skill = listExternalSkills().find((row) => row.name === name);
  if (skill === undefined) return { ok: false, error: `skill "${name}" not found in external roots` };
  const target = path.join(dshSkillRoot(), name);
  if (fs.existsSync(target)) return { ok: false, error: `DSH skill "${name}" already exists` };
  try {
    fs.mkdirSync(dshSkillRoot(), { recursive: true });
    fs.symlinkSync(skill.dir, target, "dir");
  } catch (error) {
    return { ok: false, error: String(error) };
  }
  return { ok: true };
}

/** Uninstall a previously symlinked skill (real directories are refused). */
export function uninstallSkill(name: string): { ok: boolean; error?: string } {
  const target = path.join(dshSkillRoot(), name);
  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(target);
  } catch {
    return { ok: false, error: `DSH skill "${name}" not found` };
  }
  if (!stat.isSymbolicLink()) return { ok: false, error: `not a symlink (refusing to remove real directory ${target})` };
  try {
    fs.unlinkSync(target);
  } catch (error) {
    return { ok: false, error: String(error) };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* mcp                                                                */
/* ------------------------------------------------------------------ */

/** One MCP server discovered in an external agent config. */
export interface ExternalMcpServer {
  agent: string;
  /** The external config file it came from. */
  configPath: string;
  serverName: string;
  /** Normalized transport; `remote` maps to streamable-http on import. */
  transport: "stdio" | "streamable-http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  /** Whether this server is already configured in DSH (by serverName). */
  existsInDsh?: boolean;
}

/** Extract a string map from an untrusted object (env/headers). */
function strMap(value: unknown): Record<string, string> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string") result[k] = v;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Normalize one foreign server entry into the shared payload shape. */
function normalizeEntry(
  agent: string,
  configPath: string,
  name: string,
  raw: Record<string, unknown>,
): ExternalMcpServer | undefined {
  const out: ExternalMcpServer = { agent, configPath, serverName: name, transport: "stdio" };
  const str = (value: unknown): string | undefined => (typeof value === "string" && value.length > 0 ? value : undefined);

  if (str(raw["command"]) !== undefined) {
    out.transport = "stdio";
    out.command = str(raw["command"]);
    out.args = Array.isArray(raw["args"]) ? raw["args"].filter((a): a is string => typeof a === "string") : [];
    out.env = strMap(raw["env"]);
    return out;
  }
  const url = str(raw["url"]);
  if (url !== undefined) {
    out.transport = "streamable-http";
    out.url = url;
    const extra = strMap(raw["headers"]);
    if (extra !== undefined) out.env = extra;
    return out;
  }
  return undefined; // not a recognizable server
}

/** Read `~/.claude.json` (and `~/.claude/settings.json`) mcpServers. */
function readClaudeMcp(): ExternalMcpServer[] {
  const results: ExternalMcpServer[] = [];
  const files = [path.join(os.homedir(), ".claude.json"), path.join(os.homedir(), ".claude", "settings.json")];
  for (const file of files) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const servers = data["mcpServers"];
    if (servers === null || typeof servers !== "object" || Array.isArray(servers)) continue;
    for (const [name, raw] of Object.entries(servers as Record<string, unknown>)) {
      if (raw === null || typeof raw !== "object") continue;
      const entry = normalizeEntry("claude", file, name, raw as Record<string, unknown>);
      if (entry !== undefined) results.push(entry);
    }
  }
  return results;
}

/** Read `~/.config/opencode/opencode.json` (and project `opencode.json`) `mcp`. */
function readOpencodeMcp(): ExternalMcpServer[] {
  const file = path.join(os.homedir(), ".config", "opencode", "opencode.json");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return [];
  }
  const servers = data["mcp"];
  if (servers === null || typeof servers !== "object" || Array.isArray(servers)) return [];
  const results: ExternalMcpServer[] = [];
  for (const [name, raw] of Object.entries(servers as Record<string, unknown>)) {
    if (raw === null || typeof raw !== "object") continue;
    const config = raw as Record<string, unknown>;
    // opencode stdio: `command` is an array [binary, ...args].
    if (Array.isArray(config["command"]) && config["command"].length > 0) {
      const argv = config["command"].filter((a): a is string => typeof a === "string");
      results.push({
        agent: "opencode",
        configPath: file,
        serverName: name,
        transport: "stdio",
        command: argv[0],
        args: argv.slice(1),
        env: strMap(config["env"]),
      });
      continue;
    }
    const normalized = normalizeEntry("opencode", file, name, {
      command: config["command"],
      args: config["args"],
      env: config["env"],
      url: config["url"],
      headers: config["headers"],
    });
    if (normalized !== undefined) results.push(normalized);
  }
  return results;
}

/** Very small TOML reader — enough for `[mcp_servers.*]` tables. */
function readCodexMcp(): ExternalMcpServer[] {
  const file = path.join(os.homedir(), ".codex", "config.toml");
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return [];
  }
  const unquote = (value: string): string => value.replace(/^["']|["']$/g, "");
  const entryOf = new Map<string, ExternalMcpServer>();
  let server: string | null = null; // current [mcp_servers.<name>] server
  let subTable = "";
  const section = (name: string): { s: string | null; sub: string } => {
    const root = name.trim();
    if (root === "mcp_servers") return { s: null, sub: "" };
    if (root.startsWith("mcp_servers.")) {
      const rest = root.slice("mcp_servers.".length);
      const parts = rest.split(".").map((p) => p.trim()).filter((p) => p.length > 0);
      return { s: parts[0] ?? null, sub: parts.slice(1).join(".") };
    }
    return { s: null, sub: root };
  };
  const ensure = (name: string): ExternalMcpServer => {
    let entry = entryOf.get(name);
    if (entry === undefined) {
      entry = { agent: "codex", configPath: file, serverName: name, transport: "stdio" };
      entryOf.set(name, entry);
    }
    return entry;
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const heading = /^\[(.+)\]$/.exec(line);
    if (heading !== null && heading[1] !== undefined) {
      const { s, sub } = section(heading[1]);
      server = s;
      subTable = sub;
      continue;
    }
    if (server === null) continue;
    const kv = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (kv === null || kv[1] === undefined || kv[2] === undefined) continue;
    const key = kv[1];
    const value = kv[2].trim();
    const entry = ensure(server);
    if (subTable === "env") {
      // bare `KEY = "value"` lines under [mcp_servers.x.env]
      entry.env = entry.env ?? {};
      entry.env[key] = unquote(value);
      continue;
    }
    if (subTable !== "") continue;
    if (key === "command") {
      const cmd = unquote(value);
      if (cmd.length > 0) {
        entry.transport = "stdio";
        entry.command = cmd;
        entry.args = entry.args ?? [];
      }
    } else if (key === "args") {
      const inner = value.replace(/^\[|\]$/g, "");
      entry.args = inner.split(",").map((part) => unquote(part.trim())).filter((part) => part.length > 0);
    } else if (key === "url") {
      const url = unquote(value);
      if (url.length > 0) {
        entry.transport = "streamable-http";
        entry.url = url;
      }
    } else if (key === "env") {
      // inline `env = { KEY = "value" }`
      const inner = value.replace(/^\{|\}$/g, "");
      const inline: Record<string, string> = {};
      for (const part of inner.split(",")) {
        const eq = part.indexOf("=");
        if (eq <= 0) continue;
        const k = part.slice(0, eq).trim();
        if (k.length > 0) inline[k] = unquote(part.slice(eq + 1).trim());
      }
      if (Object.keys(inline).length > 0) entry.env = inline;
    }
  }
  return [...entryOf.values()];
}

/** Read `~/.cursor/mcp.json` mcpServers. */
function readCursorMcp(): ExternalMcpServer[] {
  const file = path.join(os.homedir(), ".cursor", "mcp.json");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return [];
  }
  const servers = data["mcpServers"];
  if (servers === null || typeof servers !== "object" || Array.isArray(servers)) return [];
  const results: ExternalMcpServer[] = [];
  for (const [name, raw] of Object.entries(servers as Record<string, unknown>)) {
    if (raw === null || typeof raw !== "object") continue;
    const entry = normalizeEntry("cursor", file, name, raw as Record<string, unknown>);
    if (entry !== undefined) results.push(entry);
  }
  return results;
}

/** Scan every external MCP config; missing files are skipped silently. */
export function listExternalMcpServers(existsInDsh: (serverName: string) => boolean): ExternalMcpServer[] {
  const all = [
    ...readClaudeMcp(),
    ...readOpencodeMcp(),
    ...readCodexMcp(),
    ...readCursorMcp(),
  ];
  // Dedupe by (agent, serverName) keeping the first; then flag DSH overlap.
  const seen = new Set<string>();
  const deduped: ExternalMcpServer[] = [];
  for (const row of all) {
    const key = `${row.agent}:${row.serverName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ ...row, existsInDsh: existsInDsh(row.serverName) });
  }
  return deduped.sort((a, b) => a.agent.localeCompare(b.agent) || a.serverName.localeCompare(b.serverName));
}
