import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import z from "@deepseek-ai/schemastery";

/**
 * dsh-editor-open — host half.
 *
 * Registers an exact webserver route `/api/desktop.open-editor`:
 * - `GET`  returns a detection report: the resolved editor list (configured
 *   candidates that exist on PATH, each with its launchable path), the
 *   default editor, and the workspace directory.
 * - `POST` launches the chosen editor (`?editor=<command>`, default = the
 *   first detected candidate, i.e. VS Code when installed) with the dsh web
 *   process's working directory (the desktop's workspace) as the editor
 *   workspace; when NO editor candidate is installed it opens the workspace
 *   folder in the OS file manager instead (`mode: "explorer"`).
 *
 * The Session-header button rendered by the client half calls this route.
 *
 * Security note: this endpoint starts programs on the host machine. The web
 * server binds loopback by default and the handler only runs commands listed
 * in `editor` (no user input reaches the command line), so exposure is the
 * same as the shipped directory-picker.
 */
const name = "dsh-editor-open";
/** Services required before the route can be registered. */
const inject = ["webServer"];
/** Validated patch config: editor candidates and the workspace directory. */
const Config = z.object({
	/** Editor command candidates, tried in order; the first found on PATH becomes the default. */
	editor: z.array(z.string()).default(["code", "cursor"]),
	/** Workspace directory opened in the editor; defaults to the dsh web process cwd. */
	cwd: z.string()
});

const isWin = process.platform === "win32";
/** cmd metacharacters that would break a `start` command line (rare in real paths). */
const CMD_META = /[&|<>^"]/;

/**
 * Resolve a configured editor candidate to a launchable path.
 * On Windows, `where` usually reports the `bin/*.cmd` shim; prefer the real
 * GUI executable (`bin\..\<base>.exe` — VS Code — or `bin\..\..\<base>.exe` —
 * Cursor), so `start` spawns a GUI app (no stray console window).
 * @param command - editor command name or absolute executable path.
 * @returns the launchable path, or null when nothing usable is found.
 */
function resolveEditor(command) {
	if (path.isAbsolute(command)) {
		return existsSync(command) ? command : null;
	}
	if (!isWin) {
		const probe = spawnSync("which", [command], { stdio: "ignore" });
		return probe.status === 0 ? command : null;
	}
	const probe = spawnSync("where.exe", [command], { encoding: "utf8" });
	if (probe.status !== 0) return null;
	const hits = probe.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
	for (const hit of hits) {
		if (/\.exe$/i.test(hit)) return hit;
		if (/\.(cmd|bat)$/i.test(hit)) {
			const base = path.basename(hit, path.extname(hit));
			const dir = path.dirname(hit);
			for (const candidate of [path.join(dir, "..", `${base}.exe`), path.join(dir, "..", "..", `${base}.exe`)]) {
				if (existsSync(candidate)) return candidate;
			}
			return hit; // unusual shim layout: keep the .cmd (spawned below via start)
		}
	}
	return null;
}

/**
 * Detach-launch the editor with `dir` as its workspace; never blocks the harness.
 * On Windows `start` hands the editor to its own process, and the short-lived
 * `cmd` exits right after, so closing the desktop app never drags the editor
 * down. Arguments must stay UNQUOTED in the argv array: Node quotes them for
 * the command line, while a literal quote in the element would be re-escaped
 * (`\"`) and mangled by cmd's parser.
 */
function launch(editor, dir) {
	if (isWin && !CMD_META.test(dir)) {
		const child = spawn("cmd.exe", ["/d", "/c", "start", "", editor, dir], {
			cwd: dir,
			detached: true,
			stdio: "ignore",
			windowsHide: true
		});
		child.unref();
	} else {
		const child = spawn(editor, [dir], { cwd: dir, detached: true, stdio: "ignore", windowsHide: isWin });
		child.unref();
	}
}

/** Open the workspace folder in the OS file manager (Explorer / Finder). */
function launchExplorer(dir) {
	if (isWin) {
		// Spawning explorer.exe directly is unreliable (the shell is a
		// singleton that may ignore the request); `start` with a directory
		// path hands it to the shell, which opens it in Explorer.
		const child = spawn("cmd.exe", ["/d", "/c", "start", "", dir], {
			cwd: dir,
			detached: true,
			stdio: "ignore",
			windowsHide: true
		});
		child.unref();
	} else {
		const child = spawn("open", [dir], { detached: true, stdio: "ignore" });
		child.unref();
	}
}

/** Detect which configured editor candidates are actually installed. */
function detectEditors(candidates) {
	const editors = [];
	for (const command of candidates) {
		const resolved = resolveEditor(command);
		if (resolved !== null) editors.push({ command, path: resolved });
	}
	return editors;
}

function json(res, status, payload) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(payload));
}

/**
 * Provide the editor-launch route for the lifetime of this plugin.
 * @param ctx - plugin context carrying the webServer service.
 * @param config - validated {@link Config}.
 */
function apply(ctx, config) {
	const cwd = config.cwd ?? process.cwd();
	const candidates = [...config.editor];
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/api/desktop.open-editor",
		handler: async (req, res) => {
			const editors = detectEditors(candidates);
			const url = new URL(req.url ?? "/", "http://x");
			if (req.method === "GET") {
				json(res, 200, {
					ok: true,
					cwd,
					editors,
					default: editors[0]?.command ?? null
				});
				return;
			}
			if (req.method !== "POST") {
				json(res, 405, { ok: false, message: `method ${req.method} not allowed` });
				return;
			}
			if (url.searchParams.get("mode") === "explorer" || editors.length === 0) {
				launchExplorer(cwd);
				json(res, 200, { ok: true, mode: "explorer", cwd });
				return;
			}
			const chosen = url.searchParams.get("editor");
			let target = editors[0];
			if (chosen !== null && chosen !== "") {
				const hit = editors.find((entry) => entry.command === chosen || entry.path === chosen);
				if (hit !== void 0) target = hit;
			}
			try {
				launch(target.path, cwd);
				json(res, 200, { ok: true, mode: "editor", editor: target.command, cwd });
			} catch (error) {
				json(res, 500, {
					ok: false,
					message: error instanceof Error ? error.message : String(error)
				});
			}
		}
	}), "dsh-editor-open: /api/desktop.open-editor route");
}

export { Config, apply, inject, name };
