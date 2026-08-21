import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { installSkill, listExternalMcpServers, listExternalSkills, uninstallSkill, } from "./sync-sources.js";
/** Loader module specifier of the MCP client bridge. */
const MCP_MODULE = "@deepseek-ai/dsh-mcp-client";
/** Valid `serverName`, kept below the public tool-name budget (mirrors dsh-mcp-client). */
const SERVER_NAME_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
/** The user patch layer filename inside a profile directory. */
const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/** Upper bound on accepted JSON bodies. */
const MAX_BODY_BYTES = 64 * 1024;
/** Fiber phase labels mirroring the loader's const enum (0..5). */
const PHASE_LABELS = ["pending", "loading", "active", "failed", "disposed", "unloading"];
/** Extract a string env map from an untrusted body value (headers reuse this). */
function envOf(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    const result = {};
    for (const [k, v] of Object.entries(value)) {
        if (typeof v === "string")
            result[k] = v;
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
/** Whether a loader module specifier names an MCP client instance. */
function isMcpModule(name) {
    return name === MCP_MODULE || /(^|\/|-|:)mcp-client$/.test(name) || name.includes("mcp-client");
}
/** Extract a serverName from a loader entry's raw config. */
function serverNameOf(config, entryId) {
    if (typeof config?.serverName === "string" && config.serverName.length > 0)
        return config.serverName;
    return entryId;
}
/** Required host services: the web route registry and the loader (entry enumeration + hot create/remove). */
export const inject = ["webServer", "loader"];
function sendJson(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
    res.end(payload);
}
function sendNotFound(res) {
    sendJson(res, 404, { ok: false, error: "not-found" });
}
/** The profile's user patch layer: located through the root Include entry's config path. */
function patchFileOf(ctx) {
    const include = [...ctx.loader.entries()].find((entry) => entry.subtree !== undefined);
    if (include === undefined)
        return undefined;
    const config = include.options.config;
    if (typeof config?.path !== "string")
        return undefined;
    // The include config carries a `file:` URL; normalize to a filesystem path.
    const basePath = config.path.startsWith("file:") ? fileURLToPath(config.path) : config.path;
    return { patchPath: path.join(path.dirname(basePath), PROFILE_PATCH_FILENAME) };
}
/** Read the profile patch layer as rows; a missing/empty file reads as []. */
function readPatchRows(patchPath) {
    let text;
    try {
        text = fs.readFileSync(patchPath, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return [];
        throw error;
    }
    if (text.trim() === "")
        return [];
    const data = parseYaml(text);
    if (data === null || data === undefined)
        return [];
    if (!Array.isArray(data))
        throw new Error(`patch file must be a top-level array: ${patchPath}`);
    return data;
}
/** Preserve the patch file's leading comment/blank header, then dump the rows. */
function writePatchRows(patchPath, rows) {
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
function patchHasServer(rows, serverName) {
    return rows.some((row) => row.insert?.some((entry) => entry.name === MCP_MODULE && entry.config?.serverName === serverName));
}
/** Remove every insert row whose child names this MCP server. */
function patchRemoveServer(rows, serverName) {
    return rows.filter((row) => !row.insert?.some((entry) => entry.name === MCP_MODULE && entry.config?.serverName === serverName));
}
/** Build one MCP server view from a loader entry. */
function toMcpView(entry, persistent) {
    const config = (entry.options.config ?? {});
    const transport = typeof config.transport === "string" ? config.transport : "unknown";
    const serverName = serverNameOf(config, entry.id);
    const target = transport === "streamable-http" && typeof config.url === "string"
        ? config.url
        : transport === "stdio" && typeof config.command === "string"
            ? [config.command, ...(Array.isArray(config.args) ? config.args : [])].join(" ")
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
        ...(envOf(config.env) !== undefined ? { env: envOf(config.env) } : {}),
    };
}
/** Serve GET /settings-tabs/skills — the skill catalog of the default preset. */
async function handleSkills(ctx, res, debug) {
    try {
        // Optional service reads (no `inject` requirement): the web composition
        // mounts the skill registry and the agent-presets roster, but this plugin
        // must not fail its whole fiber (and with it the MCP tab) on a deployment
        // without either.
        const skills = ctx.get("skills");
        if (skills === undefined) {
            sendJson(res, 200, { ok: true, skills: [], note: "skill registry absent" });
            return;
        }
        // The host-plane `skill` registry is scope-layered: local discovery
        // (`skill-filesystem`) mounts behind the agent presets, not on the global
        // layer. View through the default preset's standing scope — the same
        // catalog the GUI's sessions see — without composing any agent.
        let scope;
        const presets = ctx.get("agentPresets");
        if (presets !== undefined) {
            try {
                scope = await presets.standingKeyFor();
            }
            catch {
                scope = undefined;
            }
        }
        const summaries = await skills.list({ cwd: process.cwd(), scope });
        const views = summaries.map((skill) => ({
            name: skill.name,
            description: skill.description,
            ...(skill.whenToUse !== undefined ? { whenToUse: skill.whenToUse } : {}),
            modelInvocable: skill.invocation.modelInvocable,
            userInvocable: skill.invocation.userInvocable,
            source: skill.source,
        }));
        sendJson(res, 200, { ok: true, skills: views });
    }
    catch (error) {
        sendJson(res, 200, { ok: false, error: String(error) });
    }
}
/** Serve GET /settings-tabs/mcp — every configured MCP client instance. */
function handleMcpList(ctx, res) {
    const patch = patchFileOf(ctx);
    let rows = [];
    if (patch !== undefined) {
        try {
            rows = readPatchRows(patch.patchPath);
        }
        catch {
            rows = [];
        }
    }
    const views = [];
    for (const entry of ctx.loader.entries()) {
        const moduleName = entry.options.name ?? "";
        if (!isMcpModule(moduleName))
            continue;
        const config = (entry.options.config ?? {});
        const serverName = serverNameOf(config, entry.id);
        views.push(toMcpView(entry, patchHasServer(rows, serverName)));
    }
    // Dedupe: a disabled entry shadowing a live one with the same serverName
    // (post-restart include entry vs. leftover runtime entry) — show the live one.
    const seen = new Set();
    const deduped = views
        .sort((a, b) => Number(a.enabled) - Number(b.enabled))
        .filter((view) => {
        if (seen.has(view.serverName))
            return false;
        seen.add(view.serverName);
        return true;
    })
        .sort((a, b) => a.serverName.localeCompare(b.serverName));
    sendJson(res, 200, { ok: true, servers: deduped, patchFile: patch?.patchPath });
}
/** Read a JSON request body with a size cap. */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on("data", (chunk) => {
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
            }
            catch (error) {
                reject(new Error(`invalid JSON body: ${String(error)}`));
            }
        });
        req.on("error", reject);
    });
}
/** Serve POST /settings-tabs/mcp — quick-add one MCP server (patch row + live loader entry). */
async function handleMcpAdd(ctx, res, body) {
    const patch = patchFileOf(ctx);
    if (patch === undefined) {
        sendJson(res, 200, { ok: false, code: "no-patch-layer", error: "profile patch layer not found" });
        return;
    }
    const input = (body ?? {});
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
    const env = { ...(envOf(process.env) ?? {}), ...envOf(input.env) };
    const config = { transport, serverName };
    if (Object.keys(env).length > 0)
        config.env = env;
    if (transport === "stdio") {
        const command = typeof input.command === "string" ? input.command.trim() : "";
        if (command === "") {
            sendJson(res, 200, { ok: false, code: "invalid-command", error: "command is required for stdio transport" });
            return;
        }
        config.command = command;
        config.args = Array.isArray(input.args)
            ? input.args.filter((arg) => typeof arg === "string" && arg.length > 0)
            : [];
    }
    else {
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
        if (!isMcpModule(moduleName))
            continue;
        const existing = serverNameOf((entry.options.config ?? {}), entry.id);
        if (existing === serverName) {
            sendJson(res, 200, { ok: false, code: "duplicate", error: `MCP server "${serverName}" already exists` });
            return;
        }
    }
    let rows = [];
    try {
        rows = readPatchRows(patch.patchPath);
    }
    catch (error) {
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
        await ctx.loader.create({ id: entryId, name: MCP_MODULE, config });
    }
    catch (error) {
        sendJson(res, 200, { ok: false, code: "apply-failed", error: String(error) });
        return;
    }
    sendJson(res, 200, {
        ok: true,
        server: {
            entryId,
            serverName,
            transport,
            target: transport === "stdio"
                ? [config.command, ...config.args].join(" ")
                : config.url,
            persistent: true,
            managed: true,
            note: `synced to ${patch.patchPath}`,
        },
    });
}
/** Serve DELETE /settings-tabs/mcp?serverName=… — remove the patch row and stop the live entry when possible. */
async function handleMcpRemove(ctx, res, serverName) {
    const patch = patchFileOf(ctx);
    let pendingRestart = false;
    if (patch !== undefined) {
        try {
            const rows = patchRemoveServer(readPatchRows(patch.patchPath), serverName);
            writePatchRows(patch.patchPath, rows);
        }
        catch (error) {
            sendJson(res, 200, { ok: false, code: "patch-unreadable", error: String(error) });
            return;
        }
    }
    for (const entry of ctx.loader.entries()) {
        const moduleName = entry.options.name ?? "";
        if (!isMcpModule(moduleName))
            continue;
        const existing = serverNameOf((entry.options.config ?? {}), entry.id);
        if (existing !== serverName)
            continue;
        if (entry.id.includes(":")) {
            // Patch-layer entry inside the include tree: removing it live would
            // materialize the whole composed tree into the base cordis.yml — skip.
            pendingRestart = true;
            continue;
        }
        try {
            await ctx.loader.remove(entry.id);
        }
        catch (error) {
            sendJson(res, 200, { ok: false, code: "remove-failed", error: String(error) });
            return;
        }
    }
    sendJson(res, 200, { ok: true, pendingRestart });
}
/** Serve GET /settings-tabs/sync/skills — skills found in external agent dirs. */
function handleSyncSkills(res) {
    try {
        const skills = listExternalSkills();
        sendJson(res, 200, { ok: true, skills });
    }
    catch (error) {
        sendJson(res, 200, { ok: false, error: String(error) });
    }
}
/** Serve GET /settings-tabs/sync/mcp — MCP servers found in external configs. */
function handleSyncMcpList(ctx, res) {
    try {
        const dshNames = new Set();
        for (const entry of ctx.loader.entries()) {
            const moduleName = entry.options.name ?? "";
            if (!isMcpModule(moduleName))
                continue;
            dshNames.add(serverNameOf((entry.options.config ?? {}), entry.id));
        }
        const servers = listExternalMcpServers((name) => dshNames.has(name));
        sendJson(res, 200, { ok: true, servers });
    }
    catch (error) {
        sendJson(res, 200, { ok: false, error: String(error) });
    }
}
/** Serve POST/DELETE /settings-tabs/skills/install?name=… — symlink into the DSH skill root. */
function handleSkillInstall(res, name, remove) {
    const result = remove ? uninstallSkill(name) : installSkill(name);
    sendJson(res, 200, { ok: result.ok, ...(result.error !== undefined ? { error: result.error } : {}) });
}
/* ------------------------------------------------------------------ */
/* mcp connectivity + enable/disable                                  */
/* ------------------------------------------------------------------ */
const CHECK_TIMEOUT_MS = 4000;
/** Spawn a stdio command and resolve "ok" if it stays alive past the settle
 *  window (a real MCP server keeps running), or "fail" on immediate exit /
 *  timeout. The child is always reaped. */
function checkStdio(command, args, env) {
    return new Promise((resolve) => {
        let settled = false;
        const stderrTail = [];
        const finish = (ok, detail) => {
            if (settled)
                return;
            settled = true;
            try {
                child.kill("SIGKILL");
            }
            catch {
                /* already gone */
            }
            const firstLine = stderrTail.find((line) => line.trim().length > 0);
            const enriched = firstLine !== undefined && detail.startsWith("exited")
                ? `${detail} — ${firstLine.trim().slice(0, 120)}`
                : detail;
            resolve({ ok, detail: enriched, probeEnv: env ?? {}, env: env ?? {} });
        };
        let child;
        try {
            child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, ...env } });
            child.stderr?.on("data", (chunk) => {
                for (const line of chunk.toString("utf8").split(/\r?\n/)) {
                    if (line.trim().length === 0)
                        continue;
                    stderrTail.push(line);
                    if (stderrTail.length > 8)
                        stderrTail.shift();
                }
            });
        }
        catch (error) {
            finish(false, String(error));
            return;
        }
        child.once("error", (error) => finish(false, error.message));
        // Exit code semantics for the settle window:
        //   0    — clean start (binary ran and responded / daemonized): reachable
        //   127  — login-shell wrapper: the command itself was not found: fail
        //   other — process started but crashed before the window: fail
        // A still-running child at the timeout is a live server: reachable.
        child.once("exit", (code, signal) => {
            finish(code === 0, `exited(${code ?? signal})`);
        });
        const timeout = setTimeout(() => finish(true, "running"), CHECK_TIMEOUT_MS);
        child.once("close", () => clearTimeout(timeout));
    });
}
/** Probe a streamable-http / SSE endpoint: any HTTP response means reachable;
 *  DNS/refused/timeout means not. */
async function checkHttp(url, headers) {
    try {
        const mod = new URL(url).protocol === "https:" ? await import("node:https") : await import("node:http");
        return await new Promise((resolve) => {
            const request = mod.request(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } }, (response) => {
                response.resume();
                resolve({ ok: true, detail: `http ${response.statusCode}` });
            });
            request.setTimeout(CHECK_TIMEOUT_MS, () => {
                request.destroy();
                resolve({ ok: false, detail: "timeout" });
            });
            request.on("error", (error) => resolve({ ok: false, detail: error.message }));
            request.write("{}");
            request.end();
        });
    }
    catch (error) {
        return { ok: false, detail: String(error) };
    }
}
/** Look up one live loader entry by serverName. */
function findMcpEntry(ctx, serverName) {
    for (const entry of ctx.loader.entries()) {
        const moduleName = entry.options.name ?? "";
        if (!isMcpModule(moduleName))
            continue;
        const config = (entry.options.config ?? {});
        if (serverNameOf(config, entry.id) !== serverName)
            continue;
        return { entry, config };
    }
    return undefined;
}
/** Read the stored config for a server from the patch layer (for re-enabling). */
function configOfServer(rows, serverName) {
    for (const row of rows) {
        for (const child of row.insert ?? []) {
            if (child.name === MCP_MODULE && child.config?.serverName === serverName) {
                return { ...child.config };
            }
        }
    }
    return {};
}
/**
 * The GUI host process starts with the minimal launchd PATH, which misses the
 * package-manager shim directories (homebrew, bun, cargo, …) where MCP stdio
 * commands like `uvx`/`bunx` live. Augment the probe's PATH with the common
 * locations — the probe runs inside this host process, so it cannot ask the
 * user's login shell.
 */
const DEFAULT_PATH_EXTRAS = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
];
/** Build the effective PATH for a probe: base PATH + common extras (deduped). */
function probePathFor(env, basePath) {
    const configured = typeof env?.PATH === "string" && env.PATH.length > 0 ? env.PATH : basePath;
    const merged = configured.split(":").filter(Boolean);
    for (const dir of DEFAULT_PATH_EXTRAS) {
        if (!merged.includes(dir))
            merged.push(dir);
    }
    return merged.join(":");
}
/** POSIX single-quote an argument for a login-shell probe command. */
function shellQuote(value) {
    return "'" + value.replace(/'/g, "'\\''") + "'";
}
/**
 * Build the stdio probe invocation (command, args, env) for a server config.
 * Shared by the connectivity check and the "apply fix" flow so both use the
 * exact same environment resolution (PATH augmentation, login shell, uv dir
 * redirection).
 */
function buildStdioProbe(config) {
    if (config.transport !== "stdio" || typeof config.command !== "string")
        return undefined;
    const args = Array.isArray(config.args) ? config.args : [];
    const env = envOf(config.env) ?? {};
    // The GUI host PATH misses the common package-manager directories;
    // augment it so a stdio server like `uvx blender-mcp` resolves.
    const probeEnv = { ...env, PATH: probePathFor(env, process.env.PATH ?? "") };
    // For relative bare commands (uvx, bunx, …), run the probe through the
    // user's interactive login shell so shell alias/PATH setup is honored.
    const isBare = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(config.command);
    const shell = process.env.SHELL ?? "/bin/bash";
    // The uv cache/tool dirs under the GUI host's sandbox may deny file
    // access ("Operation not permitted" on ~/.cache/uv, ~/.local/share/uv);
    // redirect uv's working dirs into the sandbox-free TMPDIR.
    const tmpdir = process.env.TMPDIR ?? "/tmp";
    const envOut = isBare
        ? { ...probeEnv, UV_CACHE_DIR: tmpdir + "/uv-probe-cache", UV_TOOL_DIR: tmpdir + "/uv-probe-tools" }
        : probeEnv;
    const command = isBare ? shell : config.command;
    const argsOut = isBare
        ? ["-lc", [config.command, ...args].map(shellQuote).join(" ")]
        : args;
    return { command, args: argsOut, env: envOut };
}
/** Serve GET /settings-tabs/mcp/check?serverName=… — one connectivity probe. */
async function handleMcpCheck(ctx, res, serverName) {
    const found = findMcpEntry(ctx, serverName);
    if (found === undefined) {
        sendJson(res, 200, { ok: true, reachable: false, detail: "not configured" });
        return;
    }
    const { entry, config } = found;
    if (entry.disabled) {
        sendJson(res, 200, { ok: true, reachable: false, detail: "disabled" });
        return;
    }
    const env = envOf(config.env);
    try {
        if (config.transport === "stdio" && typeof config.command === "string") {
            const probe = buildStdioProbe(config);
            if (probe === undefined) {
                sendJson(res, 200, { ok: true, reachable: false, detail: "unknown stdio config" });
                return;
            }
            // Capture stderr: when the child dies in the settle window the raw
            // exit code is opaque (127 = command not found, 2 = uv lock error, …);
            // the first stderr line tells the user what to fix.
            const result = await checkStdio(probe.command, probe.args, probe.env);
            sendJson(res, 200, { ok: true, reachable: result.ok, detail: result.detail });
            return;
        }
        if (config.transport === "streamable-http" && typeof config.url === "string") {
            const result = await checkHttp(config.url, env);
            sendJson(res, 200, { ok: true, reachable: result.ok, detail: result.detail });
            return;
        }
        sendJson(res, 200, { ok: true, reachable: false, detail: "unknown transport" });
    }
    catch (error) {
        sendJson(res, 200, { ok: true, reachable: false, detail: String(error) });
    }
}
/**
 * Serve POST /settings-tabs/mcp/env?serverName=… — persist the probe's
 * resolved environment (PATH + uv dir overrides) into the patch row so the
 * LIVE instance (and restarts) get the same working environment the
 * connectivity check used. The probe is re-run first: only when it is
 * reachable do we commit the env.
 */
async function handleMcpApplyEnv(ctx, res, serverName) {
    const found = findMcpEntry(ctx, serverName);
    if (found === undefined) {
        sendJson(res, 200, { ok: false, code: "not-configured", error: 'no MCP entry named "' + serverName + '"' });
        return;
    }
    const { config } = found;
    if (config.transport !== "stdio" || typeof config.command !== "string") {
        sendJson(res, 200, { ok: false, code: "not-stdio", error: "env apply is only meaningful for stdio servers" });
        return;
    }
    const probe = buildStdioProbe(config);
    if (probe === undefined) {
        sendJson(res, 200, { ok: false, code: "bad-config", error: "could not build probe for this config" });
        return;
    }
    // Confirm the probe actually works before committing anything.
    const result = await checkStdio(probe.command, probe.args, probe.env);
    if (!result.ok) {
        sendJson(res, 200, {
            ok: false,
            code: "probe-failed",
            error: "probe is not reachable with the fixed environment: " + result.detail,
        });
        return;
    }
    const patch = patchFileOf(ctx);
    if (patch === undefined) {
        sendJson(res, 200, { ok: false, code: "no-patch-layer", error: "profile patch layer not found" });
        return;
    }
    try {
        const rows = readPatchRows(patch.patchPath);
        let changed = false;
        for (const row of rows) {
            for (const child of row.insert ?? []) {
                if (child.name !== MCP_MODULE)
                    continue;
                const childConfig = child.config ?? {};
                if (serverNameOf(childConfig, "") !== serverName)
                    continue;
                // Persist only the portable fixes: PATH augmentation + uv dir
                // overrides. The user's existing env keys win.
                const storedEnv = envOf(childConfig.env) ?? {};
                const fixedEnv = {
                    ...probe.env,
                    ...Object.fromEntries(Object.entries(storedEnv).filter(([k]) => k !== "PATH")),
                };
                fixedEnv.PATH = probe.env.PATH;
                childConfig.env = fixedEnv;
                child.config = childConfig;
                changed = true;
            }
        }
        if (!changed) {
            sendJson(res, 200, { ok: false, code: "not-found", error: 'no patch row for "' + serverName + '" (entry ' + found.entry.id + ")" });
            return;
        }
        writePatchRows(patch.patchPath, rows);
    }
    catch (error) {
        sendJson(res, 200, { ok: false, code: "patch-write-failed", error: String(error) });
        return;
    }
    // Patch-layer entries (id "include:…") only take effect at restart.
    const pendingRestart = found.entry.id.includes(":");
    sendJson(res, 200, {
        ok: true,
        pendingRestart,
        detail: pendingRestart
            ? "environment persisted; the live instance picks it up on next restart"
            : "environment persisted",
    });
}
/** Serve POST /settings-tabs/mcp/toggle?serverName=…&enabled=… — enable/disable. */
async function handleMcpToggle(ctx, res, serverName, enabled) {
    const patch = patchFileOf(ctx);
    // 1) patch layer: flip the `disabled` flag on the matching insert child.
    let patchPendingRestart = false;
    if (patch !== undefined) {
        try {
            const rows = readPatchRows(patch.patchPath);
            let changed = false;
            for (const row of rows) {
                for (const child of row.insert ?? []) {
                    if (child.name === MCP_MODULE && child.config?.serverName === serverName) {
                        child.config = { ...child.config, disabled: !enabled };
                        changed = true;
                    }
                }
            }
            if (changed)
                writePatchRows(patch.patchPath, rows);
        }
        catch (error) {
            patchPendingRestart = true;
            sendJson(res, 200, { ok: false, code: "patch-unreadable", error: String(error), pendingRestart: true });
            return;
        }
    }
    // 2) live loader entry. The Loader API has no enable/disable; disabling =
    //  stop + remove the live entry (the patch row keeps `disabled: true` so it
    //  stays off across restarts), enabling = recreate the entry from config.
    const found = findMcpEntry(ctx, serverName);
    try {
        if (!enabled) {
            if (found !== undefined && !found.entry.id.includes(":")) {
                await ctx.loader.remove(found.entry.id);
            }
        }
        else if (found === undefined) {
            const config = { ...configOfServer(readPatchRows(patch?.patchPath ?? ""), serverName) };
            if (Object.keys(config).length === 0) {
                sendJson(res, 200, { ok: false, code: "no-config", error: `no config found for "${serverName}" to re-enable`, pendingRestart: true });
                return;
            }
            delete config.disabled;
            // Entries persisted before the env-merge existed may lack a PATH that
            // resolves their stdio command under the GUI host's minimal launchd
            // environment — backfill the host env (stored values win per-key).
            const storedEnv = envOf(config.env) ?? {};
            config.env = { ...(envOf(process.env) ?? {}), ...storedEnv };
            await ctx.loader.create({ id: `mcp-${serverName}`, name: MCP_MODULE, config });
        }
    }
    catch (error) {
        sendJson(res, 200, { ok: false, code: "toggle-failed", error: String(error), pendingRestart: patchPendingRestart });
        return;
    }
    sendJson(res, 200, { ok: true, enabled, pendingRestart: patchPendingRestart });
}
/**
 * Backfill the host process environment into patch-layer MCP entries that
 * were persisted before the env-merge existed. The GUI host starts with the
 * minimal launchd PATH, so stdio commands like `uvx`/`bunx` fail to
 * resolve for live instances created from such rows. User-configured keys
 * always win; the row is only rewritten when something is actually missing.
 *
 * @returns the serverNames whose patch rows were updated.
 */
function backfillPatchEnvs(ctx) {
    const patch = patchFileOf(ctx);
    if (patch === undefined)
        return [];
    let rows;
    try {
        rows = readPatchRows(patch.patchPath);
    }
    catch {
        return [];
    }
    const hostEnv = envOf(process.env) ?? {};
    const updated = [];
    let changed = false;
    for (const row of rows) {
        for (const child of row.insert ?? []) {
            if (child.name !== MCP_MODULE)
                continue;
            const config = child.config ?? {};
            const stored = envOf(config.env) ?? {};
            const merged = { ...hostEnv, ...stored };
            // A stored PATH that was captured from the GUI host's minimal launchd
            // environment lacks the package-manager shim directories (homebrew,
            // bun, …), so stdio commands like `uvx`/`bunx` never resolve. When
            // the stored PATH does not already provide the common directories,
            // upgrade it to the augmented form — the user's explicit PATH wins
            // only if it is genuinely richer than the launchd default.
            const storedPath = typeof stored.PATH === "string" ? stored.PATH : "";
            const missingExtras = DEFAULT_PATH_EXTRAS.filter((dir) => !storedPath.split(":").includes(dir));
            if (missingExtras.length === DEFAULT_PATH_EXTRAS.length) {
                // Stored PATH provides none of the common dirs: it is the launchd
                // default (or narrower) — replace with the augmented host PATH.
                merged.PATH = probePathFor(stored, process.env.PATH ?? "");
            }
            const changedKeys = Object.keys(merged).filter((key) => stored[key] !== merged[key])
                .concat(Object.keys(stored).filter((key) => merged[key] === undefined));
            if (changedKeys.length === 0)
                continue;
            config.env = merged;
            child.config = config;
            changed = true;
            const serverName = serverNameOf(config, "");
            updated.push(serverName);
        }
    }
    if (changed) {
        try {
            writePatchRows(patch.patchPath, rows);
        }
        catch {
            return [];
        }
    }
    return updated;
}
/**
 * Re-create quick-added (loader-root, `mcp-<name>`) entries so the
 * backfilled env applies to the live instance without a restart.
 * Patch-layer rows (id "include:…") are left for the next boot.
 */
async function applyManagedBackfill(ctx) {
    try {
        const patch = patchFileOf(ctx);
        if (patch === undefined)
            return;
        const rows = readPatchRows(patch.patchPath);
        for (const row of rows) {
            for (const child of row.insert ?? []) {
                if (child.name !== MCP_MODULE)
                    continue;
                const entryId = child.id;
                if (typeof entryId !== "string" || entryId.includes(":"))
                    continue;
                const config = { ...(child.config ?? {}) };
                delete config.disabled;
                let liveFound = false;
                for (const entry of ctx.loader.entries()) {
                    const moduleName = entry.options.name ?? "";
                    if (!isMcpModule(moduleName))
                        continue;
                    const existing = serverNameOf((entry.options.config ?? {}), entry.id);
                    const target = serverNameOf(config, "");
                    if (existing !== target)
                        continue;
                    liveFound = true;
                    if (entry.id.includes(":"))
                        break; // patch-layer twin: restart governs
                    try {
                        await ctx.loader.remove(entry.id);
                        await ctx.loader.create({ id: entryId, name: MCP_MODULE, config });
                    }
                    catch (error) {
                        console.warn(`[settings-tabs] managed backfill re-create failed for ${entryId}: ${String(error)}`);
                    }
                }
                if (!liveFound) {
                    // No live instance (disabled row or never started): just ensure the
                    // persisted config carries the fixed env — nothing to re-create.
                    continue;
                }
            }
        }
    }
    catch (error) {
        console.warn(`[settings-tabs] managed backfill failed: ${String(error)}`);
    }
}
/**
 * Mount the /settings-tabs routes.
 * @param ctx - host context carrying the webServer and loader services.
 */
export function apply(ctx) {
    // One-time env backfill for legacy rows (idempotent: no-ops once the
    // patch file carries the host env). Runs at fiber boot, before any route
    // can start a probe, so the first red-dot check sees the merged env.
    try {
        const updated = backfillPatchEnvs(ctx);
        if (updated.length > 0) {
            console.info(`[settings-tabs] env backfill for ${updated.length} legacy MCP row(s): ${updated.join(", ")}`);
        }
    }
    catch (error) {
        console.warn(`[settings-tabs] env backfill failed: ${String(error)}`);
    }
    // Patch-layer rows (id "include:…") cannot be hot-swapped without
    // materializing the whole composed tree, so a backfilled row only takes
    // effect at the next restart. Managed rows created by this plugin's
    // quick-add are re-created live so the fixed env applies immediately.
    void applyManagedBackfill(ctx);
    ctx.effect(() => ctx.webServer.register({
        kind: "prefix",
        path: "/settings-tabs",
        handler: async (req, res) => {
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
                        let body;
                        try {
                            body = await readJsonBody(req);
                        }
                        catch (error) {
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
                if (action === "/sync/skills" && (req.method === "GET" || req.method === "HEAD")) {
                    handleSyncSkills(res);
                    return;
                }
                if (action === "/sync/mcp" && (req.method === "GET" || req.method === "HEAD")) {
                    handleSyncMcpList(ctx, res);
                    return;
                }
                if (action === "/mcp/check" && (req.method === "GET" || req.method === "POST" || req.method === "HEAD")) {
                    await handleMcpCheck(ctx, res, url.searchParams.get("serverName") ?? "");
                    return;
                }
                if (action === "/mcp/env" && req.method === "POST") {
                    const serverName = url.searchParams.get("serverName") ?? "";
                    await handleMcpApplyEnv(ctx, res, serverName);
                    return;
                }
                if (action === "/mcp/toggle" && req.method === "POST") {
                    const serverName = url.searchParams.get("serverName") ?? "";
                    const enabled = url.searchParams.get("enabled") === "true";
                    await handleMcpToggle(ctx, res, serverName, enabled);
                    return;
                }
                if (action === "/skills/install") {
                    const name = url.searchParams.get("name") ?? "";
                    handleSkillInstall(res, name, req.method === "DELETE");
                    return;
                }
                sendNotFound(res);
            }
            catch (error) {
                sendJson(res, 200, { ok: false, code: "internal", error: String(error) });
            }
        },
    }), "dsh-settings-tabs: /settings-tabs routes");
}
