window.__ModuleLoader__.load({
	id: "dsh-editor-open",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region \0dsh-css:dsh-editor-open/src/client/EditorOpen.module.css
		const css = ".dshEditorOpenButton{border:1px solid var(--dsw-alias-border-l2);min-width:96px;height:32px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);cursor:pointer;background:0 0;border-radius:18px;justify-content:center;align-items:center;gap:4px;padding:6px 12px;font-size:13px;font-weight:400;line-height:20px;display:inline-flex}.dshEditorOpenButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dshEditorOpenButton:disabled{color:var(--dsw-alias-label-dimmed);cursor:wait}.dshEditorOpenButton span,.dshEditorOpenButton svg{flex:none}.dshEditorOpenButton span{white-space:nowrap}.dshEditorOpenGroup{display:inline-flex;align-items:center;gap:6px}.dshEditorOpenSelect{border:1px solid var(--dsw-alias-border-l2);height:32px;max-width:170px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);background:0 0;cursor:pointer;border-radius:18px;padding:0 8px;font-size:13px;font-weight:400;line-height:20px;outline:none;color-scheme:dark}.dshEditorOpenSelect:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.dshEditorOpenSelect:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}";
		const tagId = "dsh-editor-open/EditorOpen.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-editor-open";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const EditorOpen_module_css_default = { "editorOpenButton": "dshEditorOpenButton", "editorOpenGroup": "dshEditorOpenGroup", "editorOpenSelect": "dshEditorOpenSelect" };
		//#endregion
		//#region lib/types/client/controller.js
		/** One button gesture's modal state plus the editor detection state. */
		const INITIAL = { open: false, busy: false, status: null, error: null, detail: null, editors: [], selected: null, mode: "editor", cwd: null };
		const STORAGE_KEY = "dsh-editor-open:choice";
		/** Special dropdown choice that opens the workspace in the OS file manager. */
		const EXPLORER_CHOICE = "explorer";
		/** Friendly display names for well-known editor commands. */
		const EDITOR_NAMES = {
			"code": "VS Code",
			"code-insiders": "VS Code Insiders",
			"codium": "VSCodium",
			"cursor": "Cursor",
			"windsurf": "Windsurf",
			"subl": "Sublime Text",
			"webstorm": "WebStorm",
			"idea": "IntelliJ IDEA",
			"pycharm": "PyCharm",
			"goland": "GoLand",
			"clion": "CLion",
			"phpstorm": "PhpStorm",
			"rubymine": "RubyMine",
			"textmate": "TextMate"
		};
		function editorName(command) {
			return EDITOR_NAMES[command] ?? command;
		}
		/** Resolve the browser's Host base with the connection carrier's null-origin fallback. */
		function hostBase() {
			const origin = globalThis.location?.origin;
			return origin !== void 0 && origin !== "null" ? origin : "http://dsh.internal";
		}
		function readStored() {
			try {
				return globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
			} catch {
				return null;
			}
		}
		function writeStored(command) {
			try {
				globalThis.localStorage?.setItem(STORAGE_KEY, command);
			} catch { /* storage unavailable */ }
		}
		function messageOf(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Locale namespace owned by the editor-open header action. */
		const NS = "editor-open";
		/** Simplified-Chinese editor-open strings. */
		const zh = {
			"open": "打开编辑器",
			"openFolder": "打开文件夹",
			"explorerOption": "资源管理器",
			"opening": "正在打开…",
			"successTitle": "编辑器已打开",
			"successDescription": "已用 {{editor}} 打开工作目录：{{cwd}}",
			"explorerSuccessTitle": "文件夹已打开",
			"explorerSuccessDescription": "已在文件管理器中打开工作目录：{{cwd}}",
			"errorTitle": "打开失败",
			"errorDescription": "{{error}}",
			"close": "关闭"
		};
		/** English editor-open strings. */
		const en = {
			"open": "Open Editor",
			"openFolder": "Open Folder",
			"explorerOption": "File Explorer",
			"opening": "Opening…",
			"successTitle": "Editor opened",
			"successDescription": "Opened {{cwd}} with {{editor}}.",
			"explorerSuccessTitle": "Folder opened",
			"explorerSuccessDescription": "Opened {{cwd}} in the file manager.",
			"errorTitle": "Could not open",
			"errorDescription": "{{error}}",
			"close": "Close"
		};
		//#endregion
		//#region lib/types/client/HeaderAction.js
		/**
		 * Render the Session Header editor capsule: a dropdown of the detected
		 * editors (defaulting to VS Code, remembered across sessions) plus the
		 * launch button, or — when no editor is installed — a single button
		 * that opens the workspace folder in the OS file manager.
		 * @param props - slot standard props plus the bound locale.
		 * @returns the Header action and its result modal.
		 */
		function EditorOpenHeaderAction(props) {
			const { t } = props;
			const [state, setState] = react.useState(INITIAL);
			react.useEffect(() => {
				let cancelled = false;
				(async () => {
					try {
						const url = new URL("/api/desktop.open-editor", hostBase());
						const response = await fetch(url, { method: "GET" });
						const body = await response.json().catch(() => null);
						if (!response.ok || body === null || body.ok !== true) throw new Error(body?.message ?? `HTTP ${response.status}`);
						if (cancelled) return;
						const list = Array.isArray(body.editors) ? body.editors : [];
						const stored = readStored();
						const validChoices = list.map((entry) => entry.command);
						validChoices.push(EXPLORER_CHOICE);
						const selected = validChoices.includes(stored)
							? stored
							: (body.default ?? list[0]?.command ?? EXPLORER_CHOICE);
						setState((current) => ({
							...current,
							editors: list,
							selected,
							mode: list.length > 0 ? "editor" : "explorer",
							cwd: typeof body.cwd === "string" ? body.cwd : current.cwd
						}));
					} catch {
						if (!cancelled) setState((current) => ({ ...current, mode: "editor" }));
					}
				})();
				return () => {
					cancelled = true;
				};
			}, []);
			const request = async () => {
				if (state.busy) return;
				setState((current) => ({ ...current, open: true, busy: true, status: "opening" }));
				try {
					const url = new URL("/api/desktop.open-editor", hostBase());
					if (state.mode === "explorer" || state.selected === EXPLORER_CHOICE) {
						url.searchParams.set("mode", "explorer");
					} else if (state.selected !== null) {
						url.searchParams.set("editor", state.selected);
					}
					const response = await fetch(url, { method: "POST" });
					const body = await response.json().catch(() => null);
					if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
					setState((current) => ({
						...current,
						open: true,
						busy: false,
						status: "success",
						detail: body
					}));
				} catch (error) {
					setState((current) => ({ ...current, open: true, busy: false, status: "error", error: messageOf(error) }));
				}
			};
			const dismiss = () => {
				setState((current) => ({ ...current, open: false }));
			};
			const changeEditor = (command) => {
				setState((current) => ({ ...current, selected: command }));
				writeStored(command);
			};
			const status = state.status;
			// The workspace opens in the OS file manager when no editor is
			// installed, or when the dropdown's "资源管理器" choice is active.
			const explorerMode = state.mode === "explorer" || state.selected === EXPLORER_CHOICE;
			const title = status === "opening" ? t("opening") : status === "success"
				? (state.detail?.mode === "explorer" ? t("explorerSuccessTitle") : t("successTitle"))
				: t("errorTitle");
			const description = status === "success"
				? (state.detail?.mode === "explorer"
					? t("explorerSuccessDescription").replace("{{cwd}}", state.detail?.cwd ?? state.cwd ?? "")
					: t("successDescription").replace("{{editor}}", editorName(state.detail?.editor ?? "")).replace("{{cwd}}", state.detail?.cwd ?? state.cwd ?? ""))
				: status === "error"
					? t("errorDescription").replace("{{error}}", state.error ?? "")
					: t("opening");
			return react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
				children: [
					react_jsx_runtime.jsx("span", {
						className: EditorOpen_module_css_default.editorOpenGroup,
						children: [
							state.mode === "editor" && state.editors.length > 0 && react_jsx_runtime.jsx("select", {
								className: EditorOpen_module_css_default.editorOpenSelect,
								value: state.selected ?? "",
								disabled: state.busy,
								"aria-label": t("open"),
								onChange: (event) => {
									changeEditor(event.target.value);
								},
								children: [
									...state.editors.map((entry) => react_jsx_runtime.jsx("option", {
										value: entry.command,
										children: editorName(entry.command)
									}, entry.command)),
									react_jsx_runtime.jsx("option", {
										value: EXPLORER_CHOICE,
										children: t("explorerOption")
									}, EXPLORER_CHOICE)
								]
							}),
							react_jsx_runtime.jsxs("button", {
								type: "button",
								className: EditorOpen_module_css_default.editorOpenButton,
								disabled: state.busy,
								"aria-busy": state.busy,
								onClick: request,
								title: explorerMode ? t("openFolder") : t("open"),
								children: [
									react_jsx_runtime.jsx("span", { children: explorerMode ? t("openFolder") : t("open") }),
									react_jsx_runtime.jsx(explorerMode ? _deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutline16 : _deepseek_ai_dsh_client_ui_primitives.IconCodeOutline16, { size: 12 })
								]
							})
						]
					}),
					react_jsx_runtime.jsx(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: state.open,
						onClose: dismiss,
						title,
						description,
						closeLabel: t("close"),
						footer: react_jsx_runtime.jsx(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							onClick: dismiss,
							children: t("close")
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Browser plugin owning the editor-open header action. */
		const inject = ["slots", "locale"];
		/**
		 * Register the button into the Session Header utilities row, ordered
		 * before the shipped "Session log" export capsule.
		 * @param ctx - browser context carrying slots and locale services.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-editor-open: browser dictionaries");
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "editor-open",
				order: -10,
				locale: NS,
				inject: () => ({})
			}, EditorOpenHeaderAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
